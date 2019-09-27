const mongoose = require('mongoose');
const {head} = require('lodash');
const PageSchema = require('./PageSchema');
const {getDomain} = require('../lib/tools');

mongoose.set('useUnifiedTopology', true);

class MongoManager {
    constructor({ host, port, database, username, password }) {
        this.config = { host, port, database, username, password };
        this.db = null;
    }

    init() {
        this.connect();
    }

    connect() { // todo get specifique connexion not standard mongoose.connection
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

    async createOrUpdatePage({
        url, domain = getDomain(url), fetchDate = null, fetched = null, fetching = null, fetchInterest = null, match = null, language = null, error = null, errorMessage = null
    }) {
        let page = await this.getPageData(url);
        if(!page)
            page = new PageSchema();

        page.url = url;
        page.domain = domain;
        page.fetchDate = fetchDate;

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

    async getBestPageToFetch() {
        const res = await PageSchema
            .find({fetched: false, fetching: false})
            .sort({ fetchInterest: -1 })
            .limit(1);
        return head(res);
    }

    async getPageData(url) {
        return await PageSchema.findOne({url});
    }

    async getDomainsUsage(domains) {
        const query = [
            {
                '$match': {
                    'fetched': true,
                    'domain': {
                        '$in': domains
                    }
                }
            }, {
                '$group': {
                    '_id': '$domain',
                    'count': {
                        '$sum': 1
                    }
                }
            }, {
                '$project': {
                    'domain': '$_id',
                    'count': '$count'
                }
            }
        ];

        return await PageSchema.aggregate(query).exec();
    }
}

module.exports = MongoManager;
