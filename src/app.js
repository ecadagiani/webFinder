global.Promise = require('bluebird');

const Crawler = require('./crawler');
const config = require('../config');

(async () => {
    const crawler = new Crawler(config);
    await crawler.init();
    await crawler.start();
    crawler.stop();
})();
