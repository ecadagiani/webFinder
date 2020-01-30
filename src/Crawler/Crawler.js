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
const { __getRandomSearchEngineLink, __tryToGetNewLink, __getNewLink } = require( './CrawlerGetNewLink' );


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
        this.__getRandomSearchEngineLink = __getRandomSearchEngineLink.bind( this );
        this.__getNewLink = __getNewLink.bind( this );
        this.__tryToGetNewLink = __tryToGetNewLink.bind( this );

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
            const startUrl = await this.__getStartUrl();
            this.logDebug( 'start url getted:', startUrl );
            this.__loop( startUrl );
        } else
            this.error( 'no start link in config - you can add "start": "mylink.com" to config file' );
    }


    /** ******* PRIVATE FUNCTION *********/

    async __loop( url ) {
        let _url = url;
        try {
            let isFirstLoop = false;
            while (
                (this.config.loop || !isFirstLoop)
                && this.status !== Crawler.statusType.stopping
                && this.status !== Crawler.statusType.stopped
            ) {
                isFirstLoop = true;
                // SECURITY check url
                if ( !_url ) throw this.error( 'url is not valid', _url );

                // CRAWL PAGE
                _url = await this.__crawlPage( _url );
            }
            this.__stopNext();

        } catch ( err ) {
            this.logError( 'An error was occured in loop: ', err );
            throw err;
        }
    }


    async __crawlPage( url ) {
        // eslint-disable-next-line no-async-promise-executor
        await this.__setUrl( url );
        const loopStart = performance.now();
        this.logTime( 'time to complete loop' );

        if ( !url ) {
            this.logError( 'The crawler failed to find a valid url' );
            throw this.error( 'The crawler failed to find a valid url' );
        }

        // fetch page
        this.logTime( 'time to complete fetchPage' );
        const fetchedPages = await this.__tryToFetchPage( url );
        this.logTimeEnd( 'time to complete fetchPage' );

        // get new link
        this.logTime( 'time to complete getNewLink' );
        const newUrl = await this.__tryToGetNewLink( fetchedPages );
        await this.__runPlugins( 'onNewLink', newUrl );
        this.logTimeEnd( 'time to complete getNewLink' );

        // minimum wait
        this.logTimeEnd( 'time to complete loop' );
        const timeToFetch = performance.now() - loopStart;
        if ( timeToFetch < this.config.timeBetweenTwoFetch )
            await wait( this.config.timeBetweenTwoFetch - timeToFetch );

        return newUrl;
    }


    async __stopNext() {
        await this.__runPlugins( 'onStop' );
        await this.closeBrowser();
        await this.closeMongoManager();
        await this.__setStatus( Crawler.statusType.stopped );
    }

    async __getStartUrl() {
        const defaultUrl = Array.isArray( this.config.start ) ? this.config.start[this.id - 1] : this.config.start;
        let url;
        try {
            const res = await this.mongoManager.getPage( defaultUrl );
            if ( res ) url = await this.__tryToGetNewLink();
            else url = defaultUrl; // todo get _id
        } catch ( e ) {
            //todo insert on mongo, and get _id
            return defaultUrl;
        }
        return url;
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
