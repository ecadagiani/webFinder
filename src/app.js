const puppeteer = require('puppeteer');
const {get} = require('lodash');
global.Promise = require('bluebird');

const {fetchPage} = require('./lib/fetchPage');

const config = require('./config');


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
