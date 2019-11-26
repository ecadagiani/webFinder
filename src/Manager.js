const express = require( 'express' );
const bodyParser = require( 'body-parser' );
const cors = require( 'cors' );
const { findIndex } = require( 'lodash' );
const childProcess = require( 'child_process' );
const { wait } = require( '@ecadagiani/jstools' );

const defaultConfig = require( './constants/defaultConfig' );
const { crawlerStatusType } = require( './constants/crawlerconstants' );
const { initConfig } = require( './lib/initConfig' );
const config = require( '../config.json' );
const MongoManager = require( './mongo/MongoManager' );

class Manager {
    constructor() {
        this.config = initConfig( config, defaultConfig );
        this.app = null;
        this.crawlerProcess = [];
        this.mongoManager = null;
        this.__interval = null;
    }

    async init() {
        this.log( 'initialising' );
        this.mongoManager = new MongoManager( this.config, 'Manager' );
        await this.mongoManager.init();

        this.app = express();
        this.app.use( bodyParser.urlencoded( { 'extended': true } ) );
        this.app.use( bodyParser.json() );
        this.app.use( bodyParser.text() );
        this.app.use( cors( { 'origin': '*' } ) );

        this.__initRemote();

        for ( let i = 0; i < this.config.nbCrawler; i++ ) {
            await this.__startCrawler( i + 1 );
        }
        this.log( 'initialised' );
    }


    start() {
        this.app.listen( this.config.managerServerPort, () => {
            this.log( `server listening on port ${this.config.managerServerPort}` );
        } );
        this.__interval = setInterval( () => {
            this.crawlerProcess.forEach( ( { process, id, lastUpdate, status } ) => {
                if (
                    Date.now() - lastUpdate > this.config.loopMaxTimeout
                    && status !== crawlerStatusType.stopped
                ) {
                    this.__restartCrawler( id );
                }
            } );
        }, 1000 );
    }


    __initRemote() {
        this.app.get( '/', ( req, res ) => {
            res.send( 'Hello World!' );
        } );

        this.app.post( '/crawlerUpdate', ( req, res ) => {
            const { id, url, status } = req.body;
            this.__updateCrawlerProcess( { id, status, url } );
            res.send( true );
        } );
    }


    async __startCrawler( id ) {
        this.log( `start crawler ${id}` );
        const process = childProcess.fork( './src/startCrawler.js', [id] );
        process.on( 'error', ( err ) => {
            this.log( `crawler ${id} error:`, err );
            // this.__restartCrawler( id );
        } );
        process.on( 'exit', ( code ) => {
            this.log( `crawler ${id} exit` );
            // this.restartCrawler( id );
        } );

        this.logDebug( `crawler ${id} started with pid ${process.pid}` );
        this.__updateCrawlerProcess( {
            id, process, status: crawlerStatusType.initial
        } );
    }


    async __restartCrawler( id ) {
        const index = findIndex( this.crawlerProcess, { id } );
        if ( index > -1 && this.config.loop && !this.crawlerProcess[index].restart ) {
            this.log( `restart crawler ${id}` );
            this.crawlerProcess[index].restart = true;
            if ( this.crawlerProcess[index].process ) {
                this.crawlerProcess[index].process.kill();
                this.logDebug( `crawler ${id} has been killed` );
                await wait( 1000 );
                delete this.crawlerProcess[index].process;
            }
            if ( this.crawlerProcess[index].url ) {
                await this.mongoManager.createOrUpdatePage( {
                    url: this.crawlerProcess[index].url,
                    fetching: false
                } );
            }
            await this.__startCrawler( id );
            this.crawlerProcess[index].restart = false;
        }
    }


    __updateCrawlerProcess( {
        id,
        url = null,
        status = null,
        process = null,
        lastUpdate = Date.now()
    } ) {
        const index = findIndex( this.crawlerProcess, { id } );
        if ( index > -1 ) {
            if ( url ) this.crawlerProcess[index].url = url;
            if ( status ) this.crawlerProcess[index].status = status;
            if ( process ) this.crawlerProcess[index].process = process;
            this.crawlerProcess[index].lastUpdate = lastUpdate;
            this.logDebug(
                `receive update from crawler ${id}:`,
                {
                    ...this.crawlerProcess[index],
                    process: this.crawlerProcess[index].process ? typeof this.crawlerProcess[index].process : null
                }
            );
        } else {
            this.crawlerProcess.push( {
                process, id, url, lastUpdate, status
            } );
            this.logDebug(
                `add new crawler ${id}:`,
                { url, status, lastUpdate, process: process ? typeof process : null }
            );
        }
    }


    log( ...texts ) {
        const date = new Date();
        console.log( `[${date.toISOString()}] Manager: `, ...texts );
    }

    logDebug( ...texts ) {
        if ( this.config.debug )
            this.log( ...texts );
    }

    logError( ...texts ) {
        const date = new Date();
        console.error( `[${date.toISOString()}] Manager: `, ...texts );
    }

}

module.exports = Manager;
