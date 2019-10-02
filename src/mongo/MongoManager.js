const mongoose = require('mongoose');
const {head} = require('lodash');
const {wait} = require('@ecadagiani/jstools');
const PageSchema = require('./PageSchema');
const DomainSchema = require('./DomainSchema');
const {getDomain} = require('../lib/tools');

mongoose.set('useUnifiedTopology', true);
mongoose.set('useFindAndModify', false);

class MongoManager {
    constructor({mongo, domainScoreFunction, debug}, id) {
        this.config = { ...mongo, domainScoreFunction, debug };
        this.id = id;
        this.__connection = null;
        this.__PageModel = null;
        this.__DomainModel = null;
    }

    async init() {
        this.debugLog('initialising');
        await this.connect();
        this.__PageModel = this.__connection.model('Page', PageSchema);
        this.__DomainModel = this.__connection.model('Domain', DomainSchema);
        this.debugLog('initialised');
    }

    async connect() {
        const {host, port, database, username, password, maxConnectionTry, timeBetweenEachConnectionTry} = this.config;
        const mongoUri = `mongodb://${username}:${password}@${host}:${port}/${database}`;
        const options = {useNewUrlParser: true, useCreateIndex: true};

        const __connect = async (errorCount = 0) => {
            this.debugLog(`try to connect to ${mongoUri}`);
            try{
                const connection = await mongoose.createConnection(mongoUri, options);
                return connection;
            }catch (err) {
                if(errorCount >= maxConnectionTry)
                    throw err;
                else{
                    this.debugLog(`connection error: ${err.message}`);
                    await wait(timeBetweenEachConnectionTry);
                    return await __connect(errorCount + 1);
                }
            }
        };
        this.__connection = await __connect();
        this.debugLog(`connected to ${host}:${port}/${database}`);

    }

    close() {
        this.__connection.close();
        this.debugLog('connection closed');
    }

    async createOrUpdateDomain({domain, score = null, nbFetch = null}) {
        let domainToSave = await this.getDomain(domain);
        if(!domainToSave)
            domainToSave = new this.__DomainModel();
        domainToSave._id = domain;
        domainToSave.domain = domain;
        if(score !== null) domainToSave.score = score;
        if(nbFetch !== null) domainToSave.nbFetch = nbFetch;
        await domainToSave.save();
        return  domainToSave;
    }

    async _addToNbFetchToDomain(domain, nbFetch = 1) {
        let domainToSave = await this.getDomain(domain);
        if(!domainToSave)
            domainToSave = new this.__DomainModel();
        domainToSave._id = domain;
        domainToSave.domain = domain;
        domainToSave.nbFetch = (domainToSave.nbFetch || 0) + nbFetch;
        domainToSave.score = this.config.domainScoreFunction(domainToSave.domain, domainToSave.nbFetch);

        await domainToSave.save();
        return  domainToSave;
    }

    async getDomain(domain) {
        return this.__DomainModel.findById(domain);
    }

    async createOrUpdatePage({
        url,
        domain = getDomain(url), // domain used to create, or updated domain if saveDomain option is to true
        fetchDate = null,
        fetched = null,
        fetching = null,
        fetchInterest = null,
        match = null,
        language = null,
        error = null,
        errorMessage = null
    }, { // - OPTIONS
        saveDomain = true // if saveDomain is true, is use domain or the url to create an domain or updated if exist
    } = {}) {
        if(!domain) {
            const err =  new Error(`Domain recovery failed on url ${url}`);
            err.code = 6001;
            throw err;
        }

        let page = await this.getPage(url);
        if(!page)
            page = new this.__PageModel();

        if(saveDomain && fetched && !page.fetched)
            await this._addToNbFetchToDomain(domain);

        page.url = url;
        page.domain = domain;

        if(fetchDate !== null) page.fetchDate = fetchDate;
        if(fetched !== null) page.fetched = fetched;
        if(fetching !== null) page.fetching = fetching;
        if(match !== null) page.match = match;
        if(fetchInterest !== null) page.fetchInterest = fetchInterest;
        if(language !== null) page.language = language;
        if(error !== null) page.error = error;
        if(errorMessage !== null) page.errorMessage = errorMessage;

        await page.save();
        return page;
    }

    async getPage(url) {
        return this.__PageModel.findOne({url});
    }

    async getBestPageToFetch(minimumScore = null) {
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

        if(minimumScore) {
            query.push({
                '$match': {
                    'score': {
                        '$gt': minimumScore
                    }
                }
            });
        }
        query.push({
            '$sort': {
                'score': -1
            }
        });
        query.push({
            '$limit': 1
        });
        const res = await this.__PageModel.aggregate(query).exec();
        return head(res);
    }

    log(...texts) {
        const date = new Date();
        console.log(`[${date.toISOString()}] MongoManager ${this.id}: `, ...texts);
    }
    debugLog(...texts) {
        if(this.config.debug)
            this.log(...texts);
    }
}

module.exports = MongoManager;
