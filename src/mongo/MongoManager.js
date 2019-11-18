const mongoose = require( 'mongoose' );
const { head } = require( 'lodash' );
const createSemaphore = require( 'semaphore' );
const { wait } = require( '@ecadagiani/jstools' );
const PageSchema = require( './PageSchema' );
const DomainSchema = require( './DomainSchema' );
const { getDomain } = require( '../lib/tools' );

mongoose.set( 'useUnifiedTopology', true );
mongoose.set( 'useFindAndModify', false );

const domainUpdateScoreSemaphore = createSemaphore( 1 );

class MongoManager {
    constructor( { mongo, domainScoreFunction, debug }, id ) {
        this.config = { ...mongo, domainScoreFunction, debug };
        this.id = id;
        this.__connection = null;
        this.__PageModel = null;
        this.__DomainModel = null;
    }

    async init() {
        this.debugLog( 'initialising' );
        await this.connect();
        this.__PageModel = this.__connection.model( 'Page', PageSchema );
        this.__DomainModel = this.__connection.model( 'Domain', DomainSchema );
        this.debugLog( 'initialised' );
    }

    async connect() {
        const { host, port, database, username, password, maxConnectionTry, timeBetweenEachConnectionTry } = this.config;
        const mongoUri = `mongodb://${username}:${password}@${host}:${port}/${database}`;
        const options = { useNewUrlParser: true, useCreateIndex: true };

        const __connect = async ( errorCount = 0 ) => {
            this.debugLog( `try to connect to ${mongoUri}` );
            try {
                const connection = await mongoose.createConnection( mongoUri, options );
                return connection;
            } catch ( err ) {
                if ( errorCount >= maxConnectionTry )
                    throw err;
                else {
                    this.debugLog( `connection error: ${err.message}` );
                    await wait( timeBetweenEachConnectionTry );
                    return await __connect( errorCount + 1 );
                }
            }
        };
        this.__connection = await __connect();
        this.debugLog( `connected to ${host}:${port}/${database}` );

    }

    close() {
        this.__connection.close();
        this.debugLog( 'connection closed' );
    }

    async createOrUpdateDomain( { domain, score = null, nbFetch = null } ) {
        const domainToSave = {
            _id: domain,
            domain,
        };
        if ( score !== null ) domainToSave.score = score;
        if ( nbFetch !== null ) domainToSave.nbFetch = nbFetch;

        await this.__DomainModel.updateOne(
            { domain },
            domainToSave,
            {
                setDefaultsOnInsert: true,
                upsert: true,
            }
        );
        return domainToSave;
    }

    _addToNbFetchToDomain( domain, nbFetch = 1 ) {
        domainUpdateScoreSemaphore.take( async () => {
            let mongoDomain = await this.getDomain( domain );
            await this.__DomainModel.findOneAndUpdate(
                { domain },
                {
                    $inc: { 'nbFetch': nbFetch },
                    score: this.config.domainScoreFunction( domain, mongoDomain.nbFetch + nbFetch )
                },
                {
                    setDefaultsOnInsert: true,
                    upsert: true,
                }
            );
            domainUpdateScoreSemaphore.leave();
        } );
    }

    async getDomain( domain ) {
        return this.__DomainModel.findById( domain );
    }

    async createOrUpdatePage( {
        url,
        domain = getDomain( url ), // domain used to create, or updated domain if saveDomain option is to true
        fetchDate = null,
        fetched = null,
        fetching = null,
        fetchInterest = null,
        match = null,
        matchTags = null,
        language = null,
        error = null,
        errorMessage = null
    }, { // - OPTIONS
        saveDomain = false, // if saveDomain is true, is use domain or the url to create an domain or updated if exist
        addOneToDomain = false // if saveDomain is true, is use domain or the url to create an domain or updated if exist
    } = {} ) {
        if ( !domain ) {
            const err = new Error( `Domain recovery failed on url ${url}` );
            err.code = 6001;
            throw err;
        }

        const page = { url, domain };
        if ( fetchDate !== null ) page.fetchDate = fetchDate;
        if ( fetched !== null ) page.fetched = fetched;
        if ( fetching !== null ) page.fetching = fetching;
        if ( match !== null ) page.match = match;
        if ( matchTags !== null ) page.matchTags = matchTags;
        if ( fetchInterest !== null ) page.fetchInterest = fetchInterest;
        if ( language !== null ) page.language = language;
        if ( error !== null ) page.error = error;
        if ( errorMessage !== null ) page.errorMessage = errorMessage;

        await this.__PageModel.updateOne(
            { url },
            page,
            {
                setDefaultsOnInsert: true,
                upsert: true,
            }
        );

        if ( saveDomain )
            await this.createOrUpdateDomain( { domain } );

        if ( addOneToDomain )
            await this._addToNbFetchToDomain( domain );
    }

    async getPage( url ) {
        return this.__PageModel.findOne( { url } );
    }

    async getPages( urls ) {
        return this.__PageModel.find( {
            'url': { $in: urls }
        } );
    }

    async getBestPageToFetch( minimumScore = null ) {
        const query = [
            {
                '$match': {
                    'fetched': false,
                    'fetching': false,
                    'error': false
                }
            }, {
                '$lookup': {
                    'from': 'domains',
                    'localField': 'domain',
                    'foreignField': 'domain',
                    'as': 'domainObject'
                }
            }, {
                '$project': {
                    'url': '$url',
                    'fetchInterest': '$fetchInterest',
                    'domain': {
                        '$arrayElemAt': [
                            '$domainObject', 0
                        ]
                    }
                }
            }, {
                '$project': {
                    'url': '$url',
                    'score': {
                        '$add': [
                            '$fetchInterest', {
                                '$ifNull': [
                                    '$domain.score', 0
                                ]
                            }
                        ]
                    }
                }
            }
        ];

        if ( minimumScore ) {
            query.push( {
                '$match': {
                    'score': {
                        '$gt': minimumScore
                    }
                }
            } );
        }
        query.push( {
            '$sort': {
                'score': -1
            }
        } );
        query.push( {
            '$limit': 1
        } );
        const res = await this.__PageModel.aggregate( query ).exec();
        return head( res );
    }


    async isFirstMatchDomain( domain ) {
        const res = await this.__PageModel.aggregate( [
            {
                '$match': {
                    'match': true,
                    'domain': domain,
                }
            }
        ] ).exec();
        return res.length === 0;
    }

    log( ...texts ) {
        const date = new Date();
        console.log( `[${date.toISOString()}] MongoManager ${this.id}: `, ...texts );
    }

    debugLog( ...texts ) {
        if ( this.config.debug )
            this.log( ...texts );
    }
}

module.exports = MongoManager;
