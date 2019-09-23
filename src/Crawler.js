const puppeteer = require('puppeteer');
const {get} = require('lodash');
const MongoManager = require('./mongo/MongoManager');

const {checkSearchSelectors, fetchLinks, getPageLanguage} = require('./lib/fetchPage');

class Crawler {
    static async initBrowser () {
        if(!Crawler.__browser)
            Crawler.__browser = await puppeteer.launch();
    }

    static async closeBrowser () {
        if(Crawler.__browser)
            await Crawler.__browser.close();
    }

    get browser() {
        if(!Crawler.__browser)
            throw new Error('Browser not initialised');
        return Crawler.__browser;
    }

    constructor(config) {
        this.config = config;
        this.page = null;
        this.mongoManager = null;
    }

    async init() {
        await Crawler.initBrowser();
        this.page = await this.browser.newPage();
        this.mongoManager = new MongoManager(this.config.mongo);
        this.mongoManager.init();
    }

    async start() {
        if(get(this.config, 'start.link')) {
            await this.fetchPage(this.config.start.link);
        }
    }


    async fetchPage(url) {
        await this.page.goto(url);

        const page = {
            match: await checkSearchSelectors(this.page, this.config.searchSelectors),
            links: await fetchLinks(this.page, this.config.whitelist),
            language: await getPageLanguage(this.page),
        };
        console.log(page);
        //todo save links
    }

    async stop() {
        await this.page.close();
    }

}

Crawler.prototype.__browser = null;

module.exports = Crawler;
