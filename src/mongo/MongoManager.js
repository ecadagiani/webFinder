const mongoose = require('mongoose');
const CapsuleSchema = require('./PageSchema');
const {getDomain} = require('../lib/tools');

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
        mongoose.connect(mongoUri, {useNewUrlParser: true});
    }

    __onError(err) {
        console.error('db error', err);
    }
    __onConnect() {
        console.log('db success');
    }

    async createOrUpdatePage({ url, domain = getDomain(url), fetch = null, fetchInterest = null, match = null, fetchDate = null, language = null }) {
        //todo check page already exist for this url
        const page = new CapsuleSchema();
        page.url = url;
        page.domain = domain;

        if(fetch) page.fetch = fetch;
        if(fetchInterest) page.fetchInterest = fetchInterest;
        if(match) page.match = match;
        if(fetchDate) page.fetchDate = fetchDate;
        if(language) page.language = language;

        await page.save();
    }

}

module.exports = MongoManager;
