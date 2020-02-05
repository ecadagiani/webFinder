const mongoose        = require( "mongoose" );
const { head, get }   = require( "lodash" );
const createSemaphore = require( "semaphore" );
const { wait }        = require( "@ecadagiani/jstools" );
const PageSchema      = require( "./PageSchema" );
const DomainSchema    = require( "./DomainSchema" );
const { getDomain }   = require( "../lib/tools" );

mongoose.set( "useUnifiedTopology", true );
mongoose.set( "useFindAndModify", false );

const domainUpdateScoreSemaphore = createSemaphore( 1 );

class MongoManager {
    constructor( { mongo, domainScoreFunction, debug, mongoSampleSize }, id ) {
        this.config        = { ...mongo, domainScoreFunction, debug, mongoSampleSize };
        this.id            = id;
        this.__connection  = null;
        this.__PageModel   = null;
        this.__DomainModel = null;
    }

    async init() {
        this.log( "initialising" );
        await this.connect();
        this.__PageModel   = this.__connection.model( "Page", PageSchema );
        this.__DomainModel = this.__connection.model( "Domain", DomainSchema );
        this.log( "initialised" );
    }

    async connect() {
        const { host, port, database, username, password, maxConnectionTry, timeBetweenEachConnectionTry } = this.config;
        const mongoUri                                                                                     = `mongodb://${username}:${password}@${host}:${port}/${database}`;
        const options                                                                                      = { useNewUrlParser: true, useCreateIndex: true };

        const __connect   = async ( errorCount = 0 ) => {
            this.debugLog( `try to connect to ${mongoUri}` );
            try {
                return await mongoose.createConnection( mongoUri, options );
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

    async close() {
        try {
            await this.__connection.close();
            await wait( 100 );
            this.log( "Connection closed" );
        } catch ( err ) {
            this.log( "An error occured in close:", err );
        }
    }

    async createOrUpdateDomain( { domain, score = null, nbFetch = null } ) {
        const domainToSave = { domain };

        try {
            if ( score !== null ) domainToSave.score = score;
            if ( nbFetch !== null ) domainToSave.nbFetch = nbFetch;

            await this.__DomainModel.updateOne(
                { domain },
                domainToSave,
                {
                    setDefaultsOnInsert: true,
                    upsert:              true,
                },
            );
        } catch ( err ) {
            this.log( "error on create domain: ", err );
        }
        return domainToSave;
    }

    _addToNbFetchToDomain( domain, nbFetch = 1 ) {
        domainUpdateScoreSemaphore.take( async () => {
            let mongoDomain = await this.getDomain( domain );
            await this.__DomainModel.findOneAndUpdate(
                { domain },
                {
                    $inc:  { "nbFetch": nbFetch },
                    score: this.config.domainScoreFunction( domain, mongoDomain.nbFetch + nbFetch ),
                },
                {
                    setDefaultsOnInsert: true,
                    upsert:              true,
                },
            );
            domainUpdateScoreSemaphore.leave();
        } );
    }

    async getDomain( domain ) {
        return this.__DomainModel.findOne( { domain } ).lean();
    }

    /**
     *
     * @param page {Object}
     * @param options {Object}
     * @param options.saveDomain
     * @param options.addOneToDomain
     * @return {Promise<void>}
     */
    async insertPage( {
                          url,
                          domain = getDomain( url ), // domain used to create, or updated domain if saveDomain option is to true
                          ...pageRest
                      }, { // - OPTIONS
                          saveDomain = false, // if saveDomain is true, is use domain or the url to create an domain or updated if exist
                          addOneToDomain = false, // if saveDomain is true, is use domain or the url to create an domain or updated if exist
                      } = {} ) {
        if ( !domain ) {
            const err = new Error( `Domain recovery failed on url ${url}` );
            err.code  = 6001;
            throw err;
        }

        const page = new this.__PageModel( { ...pageRest, url, domain } );
        const res  = await page.save();

        if ( saveDomain )
            await this.createOrUpdateDomain( { domain } );

        if ( addOneToDomain )
            await this._addToNbFetchToDomain( domain );

        return res;
    }

    /**
     *
     * @param page {Object}
     * @param options {Object}
     * @param options.saveDomain
     * @param options.addOneToDomain
     * @return {Promise<void>}
     */
    async updatePage(
        { _id, url },
        page,
        { // - OPTIONS
            saveDomain = false, // if saveDomain is true, is use domain or the url to create an domain or updated if exist
            addOneToDomain = false, // if saveDomain is true, is use domain or the url to create an domain or updated if exist
        } = {},
    ) {

        const savedPage = await this.__PageModel.findOneAndUpdate(
            {
                ...(_id && { _id }),
                ...(url && { url }),
            },
            page,
            {
                new: true,
            },
        );

        if ( get( savedPage, "domain" ) && saveDomain )
            await this.createOrUpdateDomain( { domain: get( savedPage, "domain" ) } );

        if ( get( savedPage, "domain" ) && addOneToDomain )
            await this._addToNbFetchToDomain( get( savedPage, "domain" ) );
    }

    async getPage( url ) {
        return this.__PageModel.findOne( { url } );
    }

    async getNewLinkFromPreviousPage( pages, minScore ) {
        const query = [
            {
                "$match": {
                    "fetched": false,
                    "error":   false,
                    "_id":     { "$in": pages.map( ( { _id } ) => _id ) },
                },
            }, {
                "$lookup": {
                    "from":         "domains",
                    "localField":   "domain",
                    "foreignField": "domain",
                    "as":           "domainObject",
                },
            }, {
                "$project": {
                    "url":           "$url",
                    "fetchInterest": "$fetchInterest",
                    "domain":        {
                        "$arrayElemAt": [
                            "$domainObject", 0,
                        ],
                    },
                },
            }, {
                "$project": {
                    "url":   "$url",
                    "score": {
                        "$add": [
                            "$fetchInterest", {
                                "$ifNull": [
                                    "$domain.score", 0,
                                ],
                            },
                        ],
                    },
                },
            },
            {
                "$match": {
                    "score": { "$gte": minScore },
                },
            },
            {
                "$sort": {
                    "score": -1,
                },
            }, {
                "$limit": 1,
            },
        ];
        const res   = await this.__PageModel.aggregate( query ).exec();
        return head( res );
    }

    async getNewLinkFromMongoPage( minScore = null ) {
        const query = [
            {
                "$sample": {
                    "size": this.config.mongoSampleSize,
                },
            }, {
                "$sort": {
                    "score": -1,
                },
            }, {
                "$limit": Math.round( this.config.mongoSampleSize / 10 ),
            }, {
                "$lookup": {
                    "from":         "pages",
                    "localField":   "domain",
                    "foreignField": "domain",
                    "as":           "page",
                },
            }, {
                "$unwind": {
                    "path": "$page",
                },
            }, {
                "$project": {
                    "_id":   "$page._id",
                    "url":   "$page.url",
                    "score": {
                        "$add": [
                            "$page.fetchInterest", {
                                "$ifNull": [
                                    "$score", 0,
                                ],
                            },
                        ],
                    },
                },
            },
        ];

        if ( typeof minScore === "number" ) {
            query.push( {
                "$match": {
                    "score": {
                        "$gt": minScore,
                    },
                },
            } );
        }

        query.push(
            {
                "$sort": {
                    "score": -1,
                },
            }, {
                "$limit": 1,
            },
        );
        const res = await this.__DomainModel.aggregate( query ).exec();
        return head( res );
    }

    async isFirstMatchDomain( domain ) {
        const res = await this.__PageModel.aggregate( [
            {
                "$match": {
                    "match":  true,
                    "domain": domain,
                },
            },
        ] ).exec();
        return res.length === 0;
    }

    log( ...texts ) {
        const date = new Date();
        console.log( `[${date.toISOString()}] ${this.id} - Mongo: `, ...texts );
    }

    debugLog( ...texts ) {
        if ( this.config.debug )
            this.log( ...texts );
    }
}

module.exports = MongoManager;
