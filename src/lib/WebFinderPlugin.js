
class WebFinderPlugin {
    constructor(crawler) {
        this.__crawler = crawler;
    }

    onInit() {}
    onStart() {}
    onStop() {}
    onFetchPage(url) {}
    match(page, config) {}
    onPageIsFetched(pageData) {}
    onGetNewLink(previousFetchedPage) {}

}

module.exports = WebFinderPlugin;
