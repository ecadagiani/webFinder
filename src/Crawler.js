const puppeteer = require('puppeteer');
const {get} = require('lodash');
const mongoose = require('mongoose');

const {fetchPage} = require('./lib/fetchPage');

class Crawler {
    static async initBrowser () {
        if(!Crawler.__browser)
            Crawler.__browser = await puppeteer.launch();
    }
    get browser() {
        if(!Crawler.__browser)
            throw new Error('Browser not initialised');
        return Crawler.__browser;
    }

    constructor(config) {
        this.config = config;
        this.page = null;
    }

    async init() {
        await Crawler.initBrowser();
        this.page = await this.browser.newPage();
        this._mongoConnection();
    }

    async start() {

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
        db.on('error', err => console.error('db error', err));
        db.once('open', function() {
            console.log('db success');
        });

        const {host, port, database, username, password} = this.config.mongo;
        const mongoUri = `mongodb://${username}:${password}@${host}:${port}/${database}`;
        mongoose.connect(mongoUri, {useNewUrlParser: true});
    }
}

Crawler.prototype.__browser = null;

module.exports = Crawler;
