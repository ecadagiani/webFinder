const puppeteer = require('puppeteer');
const {get, chain, uniq} = require('lodash');

const MongoManager = require('../mongo/MongoManager');
const {wait} = require('../lib/tools');
const {checkSearchSelectors, fetchLinks, getPageLanguage} = require('./fetchPage');
const {calculInterestScore} = require('./calculInterest');
const {initConfig} = require('./initConfig');
const defaultConfig = require('./defaultConfig');
const {basicNavigationErrorCode} = require('./crawlerconstants');

class Crawler {
    constructor(config) {
        this.id = Crawler.crawlerList.push(this);
        this.config = initConfig(config, defaultConfig);
        this.page = null;
        this.mongoManager = null;
        this.breakLoop = false;
    }


    async init() {
        await this.stop();

        await Crawler.initBrowser();
        this.page = await Crawler.browser.newPage();
        this.mongoManager = new MongoManager(this.config.mongo);
        this.mongoManager.init();
        this.breakLoop = false;
        this.log('initialised');
    }


    async stop() {
        this.breakLoop = true; // todo setup better stop with an event and await function
        if(this.page && !this.page.isClosed())
            await this.page.close();
        this.page = null;
        if(this.mongoManager)
            this.mongoManager.close();
        this.mongoManager = null;
    }


    async start() {
        this.log('started');
        if(get(this.config, 'start'))
            await this.loop(this.config.start);
        else
            this.error('no start link in config - you can add "start": "mylink.com" to config file');
    }


    async loop(url) {
        const time = Date.now();
        if(this.breakLoop)
            return;

        if(!url)
            throw this.error('The crawler failed to find a valid url');

        const fetchedPages = await this._tryToFetchPage(url);

        const newUrl = await this._tryToGetNewLink(fetchedPages);

        const timeToFetch = Date.now() - time;
        this.log(`fetched in ${timeToFetch / 1000}s - ${url}`);
        if(timeToFetch < this.config.timeBetweenTwoFetch)
            await wait(this.config.timeBetweenTwoFetch - timeToFetch);

        this.loop(newUrl);
    }


    async _tryToFetchPage(url, errorCount = 0) {
        this.log(`try to fetch - ${url}`);
        let fetchedPages = [];
        try{
            fetchedPages = await this.fetchPage(url);
        }catch (err) {
            if(errorCount < 2) {
                this.logError(`error ${errorCount + 1} on fetch, crawler will try again  - ${err.message}`);
                await this.init();
                return await this.tryToFetchPage(url, errorCount + 1);
            }

            this.logError(`error ${errorCount + 1} on fetch - ${err.message}`);
            await this.mongoManager.createOrUpdatePage({
                url, error: true, fetched: false, fetching: false, errorMessage: err.toString()
            });
        }
        return fetchedPages || [];
    }

    async _tryToGetNewLink(previousFetchedPage, errorCount = 0) {
        let url = null;
        try{
            url = await this._getNewLink(previousFetchedPage);
        }catch(err) {
            if(errorCount < 2) {
                this.logError(`error ${errorCount + 1} on get new link, crawler will try again  - ${err.message}`);
                await this.init();
                return await this._tryToGetNewLink(previousFetchedPage, errorCount + 1);
            }
            throw this.error('error on get next link - ', err.message);
        }
        return url;
    }


    async fetchPage(url) {
        // access to the page and set page fetching
        try{
            await Promise.all([
                this.mongoManager.createOrUpdatePage({url, fetching: true}),
                this.page.waitForNavigation({timeout: this.config.waitForPageLoadTimeout}),
                this.page.goto(url),
            ]);
        }catch(err) {
            if(basicNavigationErrorCode.some(errorCode => err.message.includes(errorCode)) ) {
                await this.mongoManager.createOrUpdatePage({url, fetched: true, fetching: false});
                return null;
            }
            throw err;
        }

        // get page data
        let pageData = await Promise.props({
            match: await checkSearchSelectors(this.page, this.config),
            language: await getPageLanguage(this.page),
            links: await fetchLinks(this.page, this.config),
        });
        let {match = false, language, links = []} = pageData;

        // get domainsUsage
        const domains = uniq(links.map(x => x.domain));
        const domainUsage = await this.mongoManager.getDomainsUsage(domains);

        // set links score
        links = await Promise.map(links, link => ({
            ...link,
            interestScore: calculInterestScore(link.href, link.domain, link.texts, language, domainUsage, this.config),
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


    async _getNewLink(previousFetchedPage = []) {
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



    log(...texts) {
        const date = new Date();
        console.log(`[${date.toISOString()}] Crawler ${this.id}: `, ...texts);
    }


    logError(...texts) {
        const date = new Date();
        console.error(`[${date.toISOString()}] Crawler ${this.id}: `, ...texts);
    }


    error(error) {
        if(error instanceof Error)
            throw new Error(`Crawler ${this.id}: ${error.message}`);
        throw new Error(`Crawler ${this.id}: ${error}`);
    }
}


Crawler.crawlerList = [];
Crawler.__browser = null;

Crawler.initBrowser = async () => {
    if(!Crawler.__browser)
        Crawler.__browser = await puppeteer.launch({
            ignoreHTTPSErrors: true,
            headless: true,
        });
    if(!Crawler.__browser.isConnected()) {
        await Crawler.closeBrowser();
        Crawler.__browser = await puppeteer.launch();
    }
};

Crawler.closeBrowser = async () => {
    if(Crawler.__browser)
        await Crawler.__browser.close();
    Crawler.__browser = null;
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
