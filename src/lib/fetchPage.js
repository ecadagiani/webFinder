async function fetchLinks(page, whitelist) {
    const links = await page.$$eval('a', anchors => {

        function isHidden(el) {
            return (el.offsetParent === null);
        }

        return anchors
        // get only visible link, because invisible link is a common trap to catch web crawler
            .filter(anchor => !isHidden(anchor) )
            .map(anchor => anchor.href)
            .filter(href => href.includes('http'));
    });

    return links.filter(href =>
        whitelist.every(pattern => {
            const reg = new RegExp(pattern);
            return !reg.test(href);
        })
    );
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
    return null;
}


async function fetchPage(page, {whitelist, searchSelectors}) {

    return {
        match: await checkSearchSelectors(page, searchSelectors),
        links: await fetchLinks(page, whitelist),
        language: await getPageLanguage(page),
    };
}

module.exports = {
    fetchLinks,
    fetchPage
};
