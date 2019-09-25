global.Promise = require('bluebird');

const Crawler = require('./Crawler');
const config = require('../config');

(async () => {
    const crawlers = await Promise.map(new Array(config.nbCrawler), async () => {
        const crawler = new Crawler(config);
        await crawler.init();
        crawler.start();
        return crawler;
    });


    // todo never close add express
    // await Promise.each(crawlers, async (crawler) => await crawler.stop());

    // await Crawler.closeBrowser();
})();
