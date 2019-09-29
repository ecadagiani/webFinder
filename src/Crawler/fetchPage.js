const {chain} = require('lodash');
const {getUrlParts} = require('@ecadagiani/jstools');

async function fetchLinks(page, {domainWhitelist, crawlInvisibleLink, authorizedLinksExtensions, maxUrlLength, authorizedURIScheme}) {
    let links = await page.evaluate(() => {// get href and texts
        const anchors = document.querySelectorAll('a');
        return Array.from(anchors)
            .filter(anchor => !!anchor.href)
            .map(anchor => ({
                href: anchor.href,
                texts: [anchor.textContent],
                invisible: (anchor.offsetParent === null)
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


async function checkSearchSelectors(page, {searchSelectors, searchFunction: searchFunctionString}) {
    const result = await page.evaluate((selectors = [], stringFunction) => {
        const selectorRes = selectors.some(selector => !!document.querySelector(selector));
        if(selectorRes) return selectorRes;
        if(stringFunction) {
            try {
                const func = eval(stringFunction);
                if(typeof func === 'function')
                    return func();
            }catch{
                return false;
            }
        }
        return false;
    }, searchSelectors, searchFunctionString);
    return !!result;
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
