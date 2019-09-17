const config = require('../config');

async function fetchLinks(page) {
    return await page.$$eval('a', anchors => {

        function isHidden(el) {
            return (el.offsetParent === null);
        }
// todo only get http:// or https:// links (not mailto: javascript:vois(0) ... )
        return anchors
        // get only visible link, because invisible link is a common trap to catch web crawler
            .filter(anchor => !isHidden(anchor) )
            .map(anchor => anchor.href);
    });
}

async function checkSearchSelectors(page) {
    const result = await Promise.map(config.searchSelectors, async (searchSelector) => {
        return await page.$$eval(searchSelector, el => {
            return !!el;
        });
    });

    console.log(result); // todo always true
    return result.includes(true);
}


async function fetchPage(page) {

    return {
        match: await checkSearchSelectors(page),
        links: await fetchLinks(page),
    };
}

module.exports = {
    fetchLinks,
    fetchPage
};
