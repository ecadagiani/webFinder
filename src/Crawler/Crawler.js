const puppeteer = require( 'puppeteer' );
const { get } = require( 'lodash' );
const axios = require( 'axios' );
const { wait, performance } = require( '@ecadagiani/jstools' );

const defaultConfig = require( '../constants/defaultConfig' );
const { crawlerStatusType, crawlerPluginsFolderPath } = require( '../constants/crawlerconstants' );

const MongoManager = require( '../mongo/MongoManager' );
const { loadPlugins, runPlugin } = require( '../lib/toolsPlugins' );
const { promiseFunction } = require( '../lib/tools' );
const { initConfig } = require( '../lib/initConfig' );

const { error, logError, logDebug, log, logTime, logTimeEnd } = require( './CrawlerLog' );
const { __tryToFetchPage, _fetchPageData, fetchPage } = require( './CrawlerFetchPage' );
const { __getRandomSearchEngineUrl, __tryToGetNewPage, __getNewPage } = require( './CrawlerGetNewLink' );


class Crawler {
    constructor( config, id ) {
        this.id = id;
        this.config = initConfig( config, defaultConfig );
        this.browser = null;
        this.page = null;
        this.mongoManager = null;
        this.__status = Crawler.statusType.initial;
        this.__url = '';
        this.__plugins = [];

        this.error = error.bind( this );
        this.logError = logError.bind( this );
        this.logDebug = logDebug.bind( this );
        this.log = log.bind( this );
        this.logTime = logTime.bind( this );
        this.logTimeEnd = logTimeEnd.bind( this );
        this.__tryToFetchPage = __tryToFetchPage.bind( this );
        this.fetchPage = fetchPage.bind( this );
        this._fetchPageData = _fetchPageData.bind( this );
        this.__getRandomSearchEngineUrl = __getRandomSearchEngineUrl.bind( this );
        this.__getNewPage = __getNewPage.bind( this );
        this.__tryToGetNewPage = __tryToGetNewPage.bind( this );

        this.logDebug( 'debug mode' );
        if ( !this.config.loop )
            this.log( 'noLoop mode' );
    }


    get status() {
        return this.__status;
    }


    async init() {
        await this.__setStatus( Crawler.statusType.initialising );
        await this.initBrowser();
        await this.initPage();

        this.mongoManager = new MongoManager( this.config, `Crawler ${this.id}` );
        await this.mongoManager.init();
        await this.__setStatus( Crawler.statusType.initialised );
        this.__plugins = loadPlugins( crawlerPluginsFolderPath, [this], this.logDebug.bind( this ) );
        await this.__runPlugins( 'onInit' );
    }


    async initBrowser() {
        const browserOptions = {
            args: [`--lang=${this.config.browserLanguage}`],
            ...this.config.browserOptions
        };
        this.browser = await puppeteer.launch( browserOptions );
    }

    async initPage() {
        this.page = await this.browser.newPage();
    }

    async closeBrowser() {
        await this.closePage();

        try {
            if ( this.browser && this.browser.isConnected() )
                await this.browser.close();
        } catch ( err ) {
            this.logError( 'an error occured in closeBrowser', err.message );
        }
        delete this.browser;
        this.browser = null;
    }

    async closePage() {
        try {
            if ( this.page && !this.page.isClosed() )
                await this.page.close();
        } catch ( err ) {
            this.logError( 'an error occured in closePage', err.message );
        }
        delete this.page;
        this.page = null;
    }

    async closeMongoManager() {
        try {
            if ( this.mongoManager )
                await this.mongoManager.close();
        } catch ( err ) {
            this.logError( 'an error occured in closePage', err.message );
        }
        delete this.mongoManager;
        this.mongoManager = null;
    }


    async stop() {
        await this.__setStatus( Crawler.statusType.stopping );
        // eslint-disable-next-line no-async-promise-executor
        await new Promise( async resolve => {
            while ( this.__status !== Crawler.statusType.stopped ) {
                await wait( 50 );
            }
            resolve();
        } );
        return true;
    }

    async start() {
        if ( get( this.config, 'start' ) ) {
            await this.__setStatus( Crawler.statusType.running );
            await this.__runPlugins( 'onStart' );
            this.logDebug( 'get start url' );
            const startPage = await this.__getStartPage();
            this.logDebug( 'start page getted:', startPage );
            this.__loop( startPage );
        } else
            this.error( 'no start link in config - you can add "start": "mylink.com" to config file' );
    }


    /** ******* PRIVATE FUNCTION *********/

    async __loop( page ) {
        let _page = page;
        try {
            let isFirstLoop = false;
            while (
                (this.config.loop || !isFirstLoop)
                && this.status !== Crawler.statusType.stopping
                && this.status !== Crawler.statusType.stopped
            ) {
                isFirstLoop = true;
                // SECURITY check url
                if ( !_page ) throw this.error( 'page is not valid', _page );

                // CRAWL PAGE
                _page = await this.__crawlPage( _page );
            }
            this.__stopNext();

        } catch ( err ) {
            this.logError( 'An error was occured in loop: ', err );
            throw err;
        }
    }


    async __crawlPage( page ) {
        // eslint-disable-next-line no-async-promise-executor
        if ( !page ) {
            this.logError( 'The crawler failed to find a valid url' );
            throw this.error( 'The crawler failed to find a valid url' );
        }

        await this.__setUrl( page.url );
        const loopStart = performance.now();
        this.logTime( 'time to complete loop' );


        // fetch page
        this.logTime( 'time to complete fetchPage' );
        const fetchedPages = await this.__tryToFetchPage( page );
        this.logTimeEnd( 'time to complete fetchPage' );

        // get new link
        this.logTime( 'time to complete getNewPage' );
        const newPage = await this.__tryToGetNewPage( fetchedPages );
        await this.__runPlugins( 'onNewLink', newPage );
        this.logTimeEnd( 'time to complete getNewPage' );

        // minimum wait
        this.logTimeEnd( 'time to complete loop' );
        const timeToFetch = performance.now() - loopStart;
        if ( timeToFetch < this.config.timeBetweenTwoFetch )
            await wait( this.config.timeBetweenTwoFetch - timeToFetch );

        return newPage;
    }


    async __stopNext() {
        await this.__runPlugins( 'onStop' );
        await this.closeBrowser();
        await this.closeMongoManager();
        await this.__setStatus( Crawler.statusType.stopped );
    }

    async __getStartPage() {
        const defaultUrl = Array.isArray( this.config.start ) ? this.config.start[this.id - 1] : this.config.start;
        let page;
        const res = await this.mongoManager.getPage( defaultUrl );
        if ( res ) {
            page = await this.__tryToGetNewPage();
        } else {
            page = await this.mongoManager.insertPage( {url: defaultUrl}, {saveDomain: true} );
        }
        return page;
    }

    async __setStatus( status ) {
        this.__status = status;
        this.log( status );
        await this.__informManager();
    }

    async __setUrl( url ) {
        this.__url = url;
        this.log( url );
        await this.__informManager();
    }

    async __runPlugins( pluginMethod, ...params ) {
        return runPlugin( {
            plugins: this.__plugins,
            timeout: this.config.pluginTimeout,
            pluginMethod,
            params,
            handleError: ( e ) => {
                if ( this.config.showPluginTimeoutError )
                    this.logError( 'Plugin error:', e.message );
            },
        } );
    }

    async __informManager() {
        await axios.post( `http://localhost:${this.config.managerServerPort}/crawlerUpdate`, {
            id: this.id,
            status: this.status,
            url: this.__url,
        } );
    }
}

Crawler.statusType = crawlerStatusType;

module.exports = Crawler;
