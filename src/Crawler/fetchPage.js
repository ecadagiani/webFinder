const {chain, get} = require('lodash');
const {getUrlParts} = require('../lib/tools');

async function fetchLinks(page, {domainWhitelist, crawlInvisibleLink, authorizedLinksExtensions, maxUrlLength, authorizedURIScheme}) {
    let links = await page.$$eval('a', anchors => {

        function isHidden(el) {
            return (el.offsetParent === null);
        }

        return anchors
            // get href and texts
            .filter(anchor => !!anchor.href)
            .map(anchor => ({
                href: anchor.href,
                texts: [anchor.textContent],
                invisible: isHidden(anchor)
            }));
    });

    links = chain(links)
        .map(link => { // add url parts for next step
            const urlParts = getUrlParts(link.href);
            if(urlParts) return { ...link, ...getUrlParts(link.href) };
            else return { ...link, invalid: true };
        })
        .filter(({href, domain, extension, uriScheme, invisible, invalid}) => {
            // remove domainWhitelist, invisble link (depend to config), very long url, non supported uriScheme (ex: mailto:), non supported extension (ex: .png)
            if(invalid) return false;

            if(href.length > maxUrlLength) return false;
            if(!crawlInvisibleLink && invisible) return false;
            if(domainWhitelist.some(whitelisted => domain === whitelisted)) return false;
            if(!authorizedURIScheme.includes( uriScheme )) return false;
            if(extension && !authorizedLinksExtensions.includes( extension )) return false;

            return true;
        })
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
