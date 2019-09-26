const {chain} = require('lodash');
const {getDomain} = require("../lib/tools");

async function fetchLinks(page, {domainWhitelist, crawlInvisibleLink}) {
    let links = await page.$$eval('a', anchors => {

        function isHidden(el) {
            return (el.offsetParent === null);
        }

        return anchors
            // get only visible link, because invisible link is a common trap to catch web crawler
            // get only http link
            .filter(anchor => anchor.href.includes('http') )
            // get href and texts
            .map(anchor => ({
                href: anchor.href,
                texts: [anchor.textContent],
                invisible: isHidden(anchor)
            }));
    });

    // get domain of each link
    links = links.map(link => {
        return {
            ...link,
            domain: getDomain(link.href)
        };
    });

    // remove domainWhitelist link and invisble link (depend to config)
    links = links.filter(({domain, invisible}) =>
        domainWhitelist.every(whitelisted => domain !== whitelisted)
        && (crawlInvisibleLink ? true : !invisible)
    );
    // todo filter on .zip, .png, ...

    links = chain(links)
        .groupBy('href')
        .mapValues((values, key) => {
            return {
                href: key,
                domain: values[0].domain,
                texts: chain(values)
                    .map(x => x.texts)
                    .flattenDeep()
                    .filter(x => x.trim() !== '')
                    .uniq()
                    .value()
            };
        })
        .values()
        .value();
    return links;
}

async function checkSearchSelectors(page, {searchSelectors}) {
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
