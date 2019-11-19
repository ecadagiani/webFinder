const puppeteer = require( 'puppeteer' );
const { get } = require( 'lodash' );
const { wait, performance } = require( '@ecadagiani/jstools' );

const defaultConfig = require( '../constants/defaultConfig' );

const MongoManager = require( '../mongo/MongoManager' );
const { loadPlugins } = require( '../lib/loadPlugins' );
const { promiseFunction } = require( '../lib/tools' );
const { initConfig } = require( '../lib/initConfig' );

const { error, logError, logDebug, log, logTime, logTimeEnd } = require( './CrawlerLog' );
const { __tryToFetchPage, _fetchPageData, fetchPage } = require( './CrawlerFetchPage' );
const { __getRandomSearchEngineLink, __tryToGetNewLink, __getNewLink } = require( './CrawlerGetNewLink' );

class Crawler {
    constructor( config ) {
        this.id = Crawler.crawlerList.push( this );
        this.config = initConfig( config, defaultConfig );
        this.browser = null;
        this.page = null;
        this.mongoManager = null;
        this.__status = Crawler.statusType.initial;
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
    }


    get status() {
        return this.__status;
    }


    __setStatus( status ) {
        this.__status = status;
        this.log( status );
    }


    async init() {
        this.__setStatus( Crawler.statusType.initialising );
        await this.initBrowser();

        if ( this.page && !this.page.isClosed() )
            await this.page.close();
        if ( this.mongoManager )
            this.mongoManager.close();

        this.page = await this.browser.newPage();
        this.mongoManager = new MongoManager( this.config, this.id );
        await this.mongoManager.init();
        this.__setStatus( Crawler.statusType.initialised );
        this.__plugins = loadPlugins( this );
        await this.__runPlugins( 'onInit' );
    }


    async initBrowser() {
        const browserOptions = {
            args: [`--lang=${this.config.browserLanguage}`],
            ...this.config.browserOptions
        };

        if ( !this.browser )
            this.browser = await puppeteer.launch( browserOptions );
        else if ( !this.browser.isConnected() ) {
            await this.closeBrowser();
            this.browser = await puppeteer.launch( browserOptions );
        }
    }


    async closeBrowser() {
        if ( this.browser )
            await this.browser.close();
        this.browser = null;
    }


    async __runningReinit() {
        this.logDebug( 'reinit' );
        await this.initBrowser();
        if ( this.page && !this.page.isClosed() )
            await this.page.close();
        this.page = await this.browser.newPage();
        this.__runPlugins( 'onReinit' );
    }


    async stop() {
        this.__setStatus( Crawler.statusType.stopping );
        while ( this.__status !== Crawler.statusType.stopped ) {
            await wait( 50 );
        }
        return true;
    }


    async __stopNext() {
        if ( this.__isStopNextStarted ) return;
        this.__isStopNextStarted = true;
        await this.__runPlugins( 'onStop' );
        if ( this.page && !this.page.isClosed() )
            await this.page.close();
        this.page = null;
        if ( this.mongoManager )
            this.mongoManager.close();
        this.mongoManager = null;
        this.__setStatus( Crawler.statusType.stopped );
        this.__isStopNextStarted = false;
    }


    __doIhaveToStop() {
        if ( this.__status !== Crawler.statusType.stopping )
            return false;

        this.__stopNext();
        return true;
    }


    async start() {
        if ( get( this.config, 'start' ) ) {
            this.__setStatus( Crawler.statusType.running );
            await this.__runPlugins( 'onStart' );
            const startUrl = Array.isArray( this.config.start ) ? this.config.start[this.id - 1] : this.config.start;
            this.__loop( startUrl );
        } else
            this.error( 'no start link in config - you can add "start": "mylink.com" to config file' );
    }


    async __loop( url ) {
        if ( this.__doIhaveToStop() ) return;

        const loopStart = performance.now();
        this.logTime( 'time to complete loop' );

        if ( !url )
            throw this.error( 'The crawler failed to find a valid url' );

        this.logTime( 'time to complete fetchPage' );
        await this.__runPlugins( 'onFetchPage', url );
        const fetchedPages = await this.__tryToFetchPage( url );
        this.logTimeEnd( 'time to complete fetchPage' );

        if ( this.__doIhaveToStop() ) return;

        this.logTime( 'time to complete getNewLink' );
        const newUrl = await this.__tryToGetNewLink( fetchedPages );
        await this.__runPlugins( 'onNewLink', newUrl );
        this.logTimeEnd( 'time to complete getNewLink' );

        this.logTimeEnd( 'time to complete loop' );
        const timeToFetch = performance.now() - loopStart;
        if ( timeToFetch < this.config.timeBetweenTwoFetch )
            await wait( this.config.timeBetweenTwoFetch - timeToFetch );

        if ( this.config.loop )
            this.__loop( newUrl );
    }


    async __runPlugins( pluginMethod, ...params ) {
        return Promise.map( this.__plugins, async plugin => {
            if ( typeof plugin[pluginMethod] === 'function' ) {
                let res = undefined;
                try {
                    res = await promiseFunction( plugin[pluginMethod] )( ...params ).timeout( this.config.pluginTimeout );
                } catch ( e ) {
                    if ( this.config.showPluginTimeoutError )
                        this.logError( 'Plugin timed out' );
                }
                return res;
            }
            return undefined;
        } );
    }
}


Crawler.crawlerList = [];

Crawler.statusType = {
    initial: 'initial',
    initialising: 'initialising',
    initialised: 'initialised',
    running: 'running',
    stopping: 'stopping',
    stopped: 'stopped',
};

module.exports = Crawler;
