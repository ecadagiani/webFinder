const puppeteer = require('puppeteer');
const {get, orderBy, head} = require('lodash');
const MongoManager = require('./mongo/MongoManager');

const {checkSearchSelectors, fetchLinks, getPageLanguage} = require('./lib/fetchPage');
const {calculInterestScore} = require('./lib/tools');

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
        this.breakLoop = false;
    }

    async init() {
        await Crawler.initBrowser();
        this.page = await this.browser.newPage();
        this.mongoManager = new MongoManager(this.config.mongo);
        this.mongoManager.init();
    }


    async start() {
        if(get(this.config, 'start'))
            await this.loop(this.config.start);
        else
            throw new Error('no start link in config - you can add "start": "mylink.com" to config file');
    }


    async loop(url = null) {
        const fetchedLinks = await this.fetchPage(url);
        const newUrl = await this._getNewLink(fetchedLinks);

        if(this.breakLoop) // todo setup better stop
            return;

        this.loop(newUrl);
    }


    async fetchPage(url) {
        // access to the page and set page fetching
        await Promise.all([
            this.mongoManager.createOrUpdatePage({url, fetching: true}),
            this.page.goto(url)
        ]);

        // get page data
        let {match, language, links} = await Promise.props({
            match: await checkSearchSelectors(this.page, this.config.searchSelectors),
            language: await getPageLanguage(this.page),
            links: await fetchLinks(this.page, this.config.whitelist),
        });

        // set links score
        links = links.map(link => ({
            ...link,
            interestScore: calculInterestScore(link.href, link.texts, language, this.config)
        }));

        // save all data
        await Promise.mapSeries([
            {
                url,
                match,
                language,
                fetched: true,
                fetching: false,
                fetchDate: Date.now()
            },
            ...links.map(link => ({
                url: link.href,
                fetchInterest: link.interestScore,
            })),
        ], pageData => this.mongoManager.createOrUpdatePage(pageData));


        return links;
    }

    async _getNewLink(previousFetchedLinks) {
        const orderedLinks = orderBy(previousFetchedLinks, ['interestScore'], ['desc']);
        if(orderedLinks.length > 0 && head(orderedLinks).interestScore > 0) {
            // if we have previousFetchedLinks and the best links have a positive score
            return head(orderedLinks).href;
        }

        // we have zero links or the best links have a negative score,
        // we get new link from mongo
        const page = await this.mongoManager.getBestPageToFetch();
        if(page)
            return page.url;

        // todo mettre en place la recherche sur google par mot clé
    }


    async stop() {
        this.breakLoop = true; // todo setup better stop with an event and await function
        await this.page.close();
    }


}

Crawler.prototype.__browser = null;

module.exports = Crawler;
