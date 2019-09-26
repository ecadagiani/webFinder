const mongoose = require('mongoose');
const {head} = require("lodash");
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

    connect() {
        const db = mongoose.connection;
        db.on('error', this.__onError);
        db.on('open', this.__onConnect);

        const {host, port, database, username, password} = this.config;
        const mongoUri = `mongodb://${username}:${password}@${host}:${port}/${database}`;
        mongoose.connect(mongoUri, {useNewUrlParser: true, useCreateIndex: true});
    }

    __onError(err) {
    }
    __onConnect() {
    }

    async createOrUpdatePage({ url, domain = getDomain(url), fetchDate = null, fetched = null, fetching = null, fetchInterest = null, match = null, language = null }) {
        let page = await this.getPageData(url);
        if(!page)
            page = new PageSchema();

        page.url = url;
        page.domain = domain;
        page.fetchDate = fetchDate;

        if(fetched) page.fetched = fetched;
        if(fetching) page.fetching = fetching;
        if(fetchInterest) page.fetchInterest = fetchInterest;
        if(match) page.match = match;
        if(language) page.language = language;
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

}

module.exports = MongoManager;
