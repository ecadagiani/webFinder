global.Promise = require('bluebird');

const Crawler = require('./crawler');
const config = require('../config');

(async () => {
    const {MONGO_USERNAME, MONGO_PASSWORD, MONGO_HOST, MONGO_PORT, MONGO_DATABASE} = process.env
    const crawler = new Crawler({
        ...config,
        mongo: {
            host: MONGO_HOST,
            port: MONGO_PORT,
            database: MONGO_DATABASE,
            username: MONGO_USERNAME,
            password: MONGO_PASSWORD,
        }
    });
    await crawler.start();
    crawler.stop();
})();
