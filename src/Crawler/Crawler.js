const puppeteer = require('puppeteer');
const {get, chain, template, uniq} = require('lodash');

const MongoManager = require('../mongo/MongoManager');
const {wait, getRndInteger, drawWithoutDuplicate} = require('@ecadagiani/jstools');
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
        this.__time = {};
    }


    async init() {
        await this.stop();

        await Crawler.initBrowser(this.config.browserLanguage);
        this.page = await Crawler.browser.newPage();
        this.mongoManager = new MongoManager(this.config);
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


    start() {
        this.log('started');
        if(get(this.config, 'start'))
            this._loop(this.config.start);
        else
            this.error('no start link in config - you can add "start": "mylink.com" to config file');
    }


    async _loop(url) {
        this.reinitTimeMessage('loop');
        this.reinitTimeMessage('internLoopFunction');

        if(this.breakLoop)
            return;

        if(!url)
            throw this.error('The crawler failed to find a valid url');

        const fetchedPages = await this._tryToFetchPage(url);
        this.debuglogTimeMessage('time to tryToFetchPage', 'internLoopFunction');

        const newUrl = await this._tryToGetNewLink(fetchedPages);
        this.debuglogTimeMessage('time to tryToGetNewLink:', 'internLoopFunction');

        const timeToFetch = this.debuglogTimeMessage(`fetched ${url} in`, 'loop');
        if(timeToFetch < this.config.timeBetweenTwoFetch)
            await wait(this.config.timeBetweenTwoFetch - timeToFetch);

        this._loop(newUrl);
    }


    async _tryToFetchPage(url, errorCount = 0) {
        this.log(`fetch - ${url}`);
        let fetchedPages = [];
        try{
            fetchedPages = await this.fetchPage(url);
        }catch (err) {
            if(this.config.throwError)
                throw err;

            if(err.code === 6001) { // Domain recovery failed
                this.logError(`error on fetch - ${err.message}`);
                return null;
            }
            if(errorCount < 2) {
                this.logError(`error on fetch (${errorCount + 1}) - ${err.message}`);
                this.log('will try again');
                await this.init();
                return await this._tryToFetchPage(url, errorCount + 1);
            }

            this.logError(`error on fetch (${errorCount + 1}) - ${err.message}`);
            await this.mongoManager.createOrUpdatePage({
                url, error: true, fetched: false, fetching: false, errorMessage: err.toString()
            });
        }
        return fetchedPages || [];
    }


    async fetchPage(url) {
        // access to the page and set page fetching
        this.reinitTimeMessage('fetchPage');
        try{
            await Promise.all([
                this.mongoManager.createOrUpdatePage({url, fetching: true}),
                this.page.waitForNavigation({ waitUntil: ['load', 'domcontentloaded'], timeout: this.config.waitForPageLoadTimeout }), // , 'domcontentloaded'
                this.page.goto(url),
            ]);
        }catch(err) {
            if(
                Object.values(basicNavigationErrorCode).some(errorCode => err.message.includes(errorCode))
            ) {
                await this.mongoManager.createOrUpdatePage({url, fetched: true, fetching: false});
                return null;
            }
            throw err;
        }
        this.debuglogTimeMessage('time to navigate:', 'fetchPage');

        // wait for body appear (5sec max), and min 1 sec
        await Promise.all([
            this.page.waitForSelector('body', {timeout: 5000}),
            wait(1000),
        ]);

        // fetch DOM data
        let pageData = await Promise.props({
            match: await checkSearchSelectors(this.page, this.config),
            language: await getPageLanguage(this.page),
            links: await fetchLinks(this.page, this.config),
        });
        let {match = false, language, links = []} = pageData;
        this.debuglogTimeMessage('time to fetch DOM data:', 'fetchPage');

        // calculate links score
        links = await Promise.map(links, async link => ({
            ...link,
            interestScore: await calculInterestScore(link.href, link.domain, link.texts, language, this.config),
        }));
        this.debuglogTimeMessage('time to calculate links score:', 'fetchPage');

        // save all data
        const res =  await Promise.map([
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
        this.debuglogTimeMessage('time to save all data in mongo:', 'fetchPage');
        return res;
    }


    async _tryToGetNewLink(previousFetchedPage, errorCount = 0) {
        let url = null;
        try{
            url = await this._getNewLink(previousFetchedPage);
        }catch(err) {
            if(this.config.throwError)
                throw err;
            if(errorCount < 2) {
                this.logError(`error ${errorCount + 1} on get new link, crawler will try again  - ${err.message}`);
                await this.init();
                return await this._tryToGetNewLink(previousFetchedPage, errorCount + 1);
            }
            throw this.error('error on get next link - ', err.message);
        }
        return url;
    }


    async _getNewLink(previousFetchedPage = []) {
        let futurPage = null;

        const allDomains = uniq(previousFetchedPage.map(x => x.domain).filter(x => !!x));
        const domainsDb = await Promise.map(allDomains, domain => this.mongoManager.getDomain(domain));
        const domainScore = domainsDb
            .filter(x => !!x)
            .reduce((obj, domain) => {
                obj[domain.domain] = domain.score;
                return obj;
            }, {});

        futurPage = chain(previousFetchedPage)
            .map(page => ({
                fetched: page.fetched,
                fetching: page.fetched,
                url: page.url,
                score: page.fetchInterest + (get(domainScore, page.domain) || 0)
            }))
            .filter(page =>
                !page.fetched
                && !page.fetching
                && page.score > this.config.interestMinimumScoreToContinue
            )
            .orderBy(['score'], ['desc'])
            .head()
            .value();

        // if we have fetched a link with a correct score (interestMinimumScoreToContinue), we return this
        if(futurPage)
            return futurPage.url;

        // if we have zero valid links, we get new link from mongo, but with a decent score (interestMinimumScoreToFetchDb)
        futurPage = await this.mongoManager.getBestPageToFetch(this.config.interestMinimumScoreToFetchDb);
        if(futurPage)
            return futurPage.url;


        // if we don't have a decent link in mongo, we find new links with config searchEngineUrl
        if(this.config.searchEngineUrl) {
            const searchEngineLink = this._getRandomSearchEngineLink();
            const searchEngineLinkMongo = await this.mongoManager.getPage(searchEngineLink);
            // if duckduckgo links is not present in mongo or if it was fetched more than 15 days ago
            if(
                !searchEngineLink
                || Date.now() - (get(searchEngineLinkMongo, 'fetchDate') || new Date() ).getTime() > 15 * 24 * 60 * 60 * 1000
            )
                return searchEngineLink;
        }


        // if searchEngine link have already been fetch, we get link from mongo without decent score
        futurPage = await this.mongoManager.getBestPageToFetch();
        if(futurPage)
            return futurPage.url;

        return null;
    }


    _getRandomSearchEngineLink() {
        const {searchTags, maxCombinationSearchTags} = this.config;
        const nbTagsToDraw = getRndInteger(
            1,
            searchTags.length < maxCombinationSearchTags ? searchTags.length : maxCombinationSearchTags
        );

        const resTags = drawWithoutDuplicate(searchTags, nbTagsToDraw);
        // const ddgUrl = new URL('https://duckduckgo.com');
        // ddgUrl.searchParams.set('q', resTags.join(' '));
        // return ddgUrl.href;

        let url = null;
        try{
            const compiled = template( this.config.searchEngineUrl );
            url = compiled( {query: resTags.join('+')} );
        }catch( e ) {
            return null;
        }
        return url;
    }


    log(...texts) {
        const date = new Date();
        console.log(`[${date.toISOString()}] Crawler ${this.id}: `, ...texts);
    }
    debugLog(...texts) {
        if(this.config.debug)
            this.log(...texts);
    }

    logError(...texts) {
        const date = new Date();
        console.error(`[${date.toISOString()}] Crawler ${this.id}: `, ...texts);
    }

    debuglogTimeMessage(text, timeId = 'default') {
        const timeToFetch = Date.now() - this.__time[timeId];
        this.__time[timeId] = Date.now();
        this.debugLog(text, `${timeToFetch / 1000}s`);
        return timeToFetch;
    }
    reinitTimeMessage(timeId = 'default') {
        this.__time[timeId] = Date.now();
    }

    error(error) {
        if(error instanceof Error)
            throw new Error(`Crawler ${this.id}: ${error.message}`);
        throw new Error(`Crawler ${this.id}: ${error}`);
    }
}


Crawler.crawlerList = [];
Crawler.__browser = null;

Crawler.initBrowser = async (browserLanguage = 'en-US') => {
    const browserOptions = {
        ignoreHTTPSErrors: true,
        headless: true,
        args: [`--lang=${browserLanguage}`]
    };

    if(!Crawler.__browser)
        Crawler.__browser = await puppeteer.launch(browserOptions);
    if(!Crawler.__browser.isConnected()) {
        await Crawler.closeBrowser();
        Crawler.__browser = await puppeteer.launch(browserOptions);
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
