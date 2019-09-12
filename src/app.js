const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://www.meteocentrale.ch/it/europa/svizzera/meteo-corvatsch/details/S067910/');

    const result = await page.evaluate(() => {
        let temperature = document.querySelector('.column-4').innerText;
        return {
            temperature
        };
    });

    console.log(result);

    browser.close();
})();
