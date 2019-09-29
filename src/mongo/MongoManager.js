const mongoose = require('mongoose');
const {head} = require('lodash');
const PageSchema = require('./PageSchema');
const DomainSchema = require('./DomainSchema');
const {getDomain} = require('../lib/tools');

mongoose.set('useUnifiedTopology', true);
mongoose.set('useFindAndModify', false);

class MongoManager { // todo make singleton
    constructor({mongo: {host, port, database, username, password}, domainScoreFunction}) {
        this.config = { host, port, database, username, password, domainScoreFunction };
        this.db = null;
    }

    init() {
        this.connect();
    }

    connect() {
        this.db = mongoose.connection;
        this.db.on('error', this.__onError);
        this.db.on('open', this.__onConnect);

        const {host, port, database, username, password} = this.config;
        const mongoUri = `mongodb://${username}:${password}@${host}:${port}/${database}`;
        mongoose.connect(mongoUri, {useNewUrlParser: true, useCreateIndex: true});
    }

    close() {
        mongoose.connection.close();
    }

    __onError(err) {
    }
    __onConnect() {
    }


    async createOrUpdateDomain({domain, score = null, nbFetch = null}) {
        let domainToSave = await this.getDomain(domain);
        if(!domainToSave)
            domainToSave = new DomainSchema();
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
            domainToSave = new DomainSchema();
        domainToSave._id = domain;
        domainToSave.domain = domain;
        domainToSave.nbFetch = (domainToSave.nbFetch || 0) + nbFetch;
        domainToSave.score = this.config.domainScoreFunction(domainToSave.domain, domainToSave.nbFetch);

        await domainToSave.save();
        return  domainToSave;
    }

    async getDomain(domain) {
        return await DomainSchema.findById(domain);
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
            page = new PageSchema();

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
        return await PageSchema.findOne({url});
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
        const res = await PageSchema.aggregate(query).exec();
        return head(res);
    }

}

module.exports = MongoManager;
