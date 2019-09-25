const {chain} = require('lodash');

async function fetchLinks(page, whitelist) {
    let links = await page.$$eval('a', anchors => {

        function isHidden(el) {
            return (el.offsetParent === null);
        }

        return anchors
            // get only visible link, because invisible link is a common trap to catch web crawler
            // get only http link
            .filter(anchor => !isHidden(anchor) && anchor.href.includes('http') )
            // get href and texts
            .map(anchor => ({href: anchor.href, texts: [anchor.textContent]}));
    });

    // remove whitelist link
    links = links.filter(({href}) =>
        whitelist.every(pattern => { // todo change whitelist to domainWhitelist
            const reg = new RegExp(pattern, 'i');
            return !reg.test(href);
        })
    );

    links = chain(links)
        .groupBy('href')
        .mapValues((values, key) => ({
            href: key,
            texts: chain(values)
                .map(x => x.texts)
                .flattenDeep()
                .filter(x => x.trim() !== '')
                .uniq()
                .value()
        }))
        .values()
        .value();
    return links;
}

async function checkSearchSelectors(page, searchSelectors) {
    const result = await Promise.map(searchSelectors, async (searchSelector) => {
        return await page.$$eval(searchSelector, el => {
            return Array.isArray(el) && el.length > 0;
        });
    });
    return result.includes(true);
}

async function getPageLanguage(page) {
    return await page.evaluate(() => {
        return document.documentElement.lang;
    });
}

module.exports = {
    fetchLinks,
    getPageLanguage,
    checkSearchSelectors,
};
