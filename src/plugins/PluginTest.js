const WebFinderPlugin = require('../lib/WebFinderPlugin');

class PluginTest extends WebFinderPlugin {

    constructor(...params) {
        super(...params);
        this.onInit = this.onInit.bind(this);
        this.onStart = this.onStart.bind(this);
        this.onStop = this.onStop.bind(this);
        this.onFetchPage = this.onFetchPage.bind(this);
        this.match = this.match.bind(this);
        this.onPageIsFetched = this.onPageIsFetched.bind(this);
        this.onGetNewLink = this.onGetNewLink.bind(this);
    }

    onInit() {}
    onStart() {}
    onStop() {}
    onFetchPage(url) {}
    match(page, config) {}
    onPageIsFetched(pageData) {}
    onGetNewLink(previousFetchedPage) {}

}

module.exports = PluginTest;
