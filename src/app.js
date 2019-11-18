const express = require( 'express' );
const bodyParser = require( 'body-parser' );
const cors = require( 'cors' );
global.Promise = require( 'bluebird' );

const Crawler = require( './Crawler/Crawler' );
// eslint-disable-next-line node/no-missing-require
const config = require( '../config.json' );


const app = express();
app.use( bodyParser.urlencoded( { 'extended': true } ) );
app.use( bodyParser.json() );
app.use( bodyParser.text() );
app.use( cors( { 'origin': '*' } ) );

app.listen( process.env.PORT, async () => {
    console.log(`launch ${config.nbCrawler} Crawlers`);
    const crawlers = await Promise.map(new Array(config.nbCrawler), async () => {
        const crawler = new Crawler(config);
        await crawler.init();
        await crawler.start();
        return crawler;
    });
    console.log('All Crawlers are launched');
} );
