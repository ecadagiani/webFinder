global.Promise = require( 'bluebird' );

const Crawler = require( './Crawler/Crawler' );
const config = require( '../config.json' );


async function startCrawler() {
    const args = process.argv.slice( 2 );
    if ( args.length < 1 ) {
        throw new Error( 'invalid number of args' );
    }
    const id = Number( args[0] );

    const crawler = new Crawler( config, id );
    await crawler.init();
    await crawler.start();
    return crawler;
}

const crawler = startCrawler();
