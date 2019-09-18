const puppeteer = require('puppeteer');
const {get} = require('lodash');
const mongoose = require('mongoose');
global.Promise = require('bluebird');


const {fetchPage} = require('./lib/fetchPage');

const config = require('./config');

const {MONGO_USERNAME, MONGO_PASSWORD, MONGO_HOST, MONGO_PORT, MONGO_DATABASE} = process.env;
const mongoUri = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`;
console.log(mongoUri)
mongoose.connect(mongoUri, {useNewUrlParser: true});

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    if(get(config, 'start.link')) {
        await page.goto(config.start.link);
    }

    const pageData = await fetchPage(page);
    console.log(pageData);

    browser.close();
})();
