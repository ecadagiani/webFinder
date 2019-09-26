const puppeteer = require('puppeteer');
const {get, chain, head} = require('lodash');
const MongoManager = require('../mongo/MongoManager');

const {checkSearchSelectors, fetchLinks, getPageLanguage} = require('./fetchPage');
const {calculInterestScore} = require('./calculInterest');
const {initConfig} = require('./initConfig');
const defaultConfig = require('./defaultConfig');

class Crawler {
    constructor(config) {
        this.id = Crawler.crawlerList.push(this);
        this.config = initConfig(config, defaultConfig);
        this.page = null;
        this.mongoManager = null;
        this.breakLoop = false;
    }

    log(...texts) {
        console.log(`Crawler ${this.id}: `, ...texts);
    }

    logError(...texts) {
        console.error(`Crawler ${this.id}: `, ...texts);
    }

    error(error) {
        if(error instanceof Error)
            throw new Error(`Crawler ${this.id}: ${error.message}`);
        throw new Error(`Crawler ${this.id}: ${error}`);
    }

    async init() {
        await Crawler.initBrowser();
        this.page = await Crawler.browser.newPage();
        this.mongoManager = new MongoManager(this.config.mongo);
        this.mongoManager.init();
        this.log('initialised');
    }


    async start() {
        this.log('started');
        if(get(this.config, 'start'))
            await this.loop(this.config.start);
        else
            this.error('no start link in config - you can add "start": "mylink.com" to config file');
    }


    async loop(url = null) {
        this.log(`fetch ${url}`);
        let fetchedPages = [];
        try{
            fetchedPages = await this.fetchPage(url);
        }catch (err) {
            this.logError('error on fetchPage: ', err.message);
        }

        let newUrl;
        try{
            newUrl = await this._getNewLink(fetchedPages);
        }catch (err) {
            this.logError('error on _getNewLink: ', err.message);
        }

        if(this.breakLoop)
            return;

        if(!newUrl)
            return this.error('The crawler failed to find a valid url');

        this.loop(newUrl);
    }


    async fetchPage(url) {
        // access to the page and set page fetching
        await Promise.all([
            this.mongoManager.createOrUpdatePage({url, fetching: true}),
            this.page.goto(url)
        ]);

        // get page data
        let pageData = await Promise.props({
            match: await checkSearchSelectors(this.page, this.config),
            language: await getPageLanguage(this.page),
            links: await fetchLinks(this.page, this.config),
        });
        let {match, language, links} = pageData;

        // todo get for each link the number of usage of this domain


        // set links score
        links = await Promise.map(links, link => ({
            ...link,
            interestScore: calculInterestScore(link.href, link.texts, language, this.config),
        }));

        // save all data
        return await Promise.map([
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
                domain: link.domain,
                fetchInterest: link.interestScore,
            })),
        ], pageData => this.mongoManager.createOrUpdatePage(pageData));
    }


    async _getNewLink(previousFetchedPage) {
        const futurPage = chain(previousFetchedPage)
            .filter(page =>
                !page.fetched
                && !page.fetching
                && page.fetchInterest > this.config.interestMinimumScoreToContinue
            )
            .orderBy(['interestScore'], ['desc'])
            .head()
            .value();

        if(futurPage)
            return futurPage.url;

        // we have zero valid links, we get new link from mongo
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

Crawler.crawlerList = [];
Crawler.__browser = null;

Crawler.initBrowser = async () => {
    if(!Crawler.__browser)
        Crawler.__browser = await puppeteer.launch();
};

Crawler.closeBrowser = async () => {
    if(Crawler.__browser)
        await Crawler.__browser.close();
};

Object.defineProperty(
    Crawler,
    'browser',
    {
        get: () => {
            if(!Crawler.__browser)
                throw new Error('Browser not initialised');
            return Crawler.__browser;
        }
    }
);


Crawler.prototype.__browser = null;

module.exports = Crawler;
