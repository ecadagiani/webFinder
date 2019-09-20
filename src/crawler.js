const puppeteer = require('puppeteer');
const {get} = require('lodash');
const mongoose = require('mongoose');

const {fetchPage} = require('./lib/fetchPage');

class Crawler {
    constructor(config) {
        this.config = config;
        this.browser = null;
        this.page = null;
    }

    async start() {
        this._mongoConnection();

        this.browser = await puppeteer.launch();
        this.page = await this.browser.newPage();

        if(get(this.config, 'start.link')) {
            await this.page.goto(this.config.start.link);
        }

        const pageData = await fetchPage(this.page, this.config);
        console.log(pageData);
    }

    stop() {
        this.browser.close();
    }

    _mongoConnection() {
        const db = mongoose.connection;
        db.on('error', err => console.error("db error", err));
        db.once('open', function() {
            console.log("db success");
        });

        const {host, port, database, username, password} = this.config.mongo;
        const mongoUri = `mongodb://${username}:${password}@${host}:${port}/${database}`;
        mongoose.connect(mongoUri, {useNewUrlParser: true});
    }

}

module.exports = Crawler;
