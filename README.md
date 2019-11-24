# webFinder
WebFinder is a highly configurable crawler on puppeteer, run in docker, 
to match specific page on the web.

[DockerHub - webFinder](https://hub.docker.com/repository/docker/ecadagiani/webfinder)

WORK IN PROGRESS

## Installation
```bash
    docker
```

## Usage

[Puppeteer docs](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md)

## Configuration
There is the default config
```json
{
    "debug": false,
    "throwError": false,
    "showPluginTimeoutError": true,
    "loop": true,
    "nbCrawler": 1,
    "start": "", // can be an url or an array of url
    "searchSelectors": [],
    "mongo": {
        "host": "",
        "port": "",
        "database": "",
        "username": "",
        "password": "",
        "maxConnectionTry": 3,
        "timeBetweenEachConnectionTry": 4000
    },
    "pluginTimeout": 3000,
    "browserLanguage": "en-US",
    "browserOptions": {
        "ignoreHTTPSErrors": true,
        "headless": true
    },

    "loopMaxTimeout": 120000,
    "waitForPageLoadTimeout": 30000,
    "maxErrorFetchPage": 3,
    "maxErrorGetNewLink": 3,
    "maxUrlLength": 800,
    "timeBetweenTwoFetch": 1000,
    "crawlInvisibleLink": false,
    "waitForBodyAppear": true,
    "timeoutForBodyAppear": 5000,
    "domainScoreFunction": "(domain, nbFetch) => nbFetch < 50 ? 0 : Math.floor( (nbFetch-50) * -5 )",
    "interestMinimumScoreToContinue": 0,
    "interestMinimumScoreToFetchDb": 0,
    "interestRandRange": {
        "min": 0, "max": 2
    },

    "mergeAuthorizedLinksExtensions": true,
    "authorizedLinksExtensions": [
        "html",
        "html5",
        "htm",
        "php",
        "php3"
    ],
    "mergeAuthorizedURIScheme": true,
    "authorizedURIScheme": [
        "http",
        "https",
        "shttp"
    ],

    "interestLanguage": [],
    "interestLanguageImpact": 20,
    "uninterestLanguageImpact": -10,
    "domainWhitelist": [
        "libraryofbabel.info",
        "theinfinitelibrary.com"
    ],
    "mergeDomainWhitelist": true,

    "interestTag": [],
    "interestTagDefaultImpact": 1,
    "mergeInterestTag": true,

    "uninterestingTag": [
        {
            "tag": "admin", "impact": -1
        },
        "password",
        "register",
        "registration",
        "login",
        "identifier",
        "connecter",
        "wishlist,",
        "filter",
        "limit",
        "order",
        "sort",
        "add"
    ],
    "uninterestingTagDefaultImpact": -1,
    "mergeUninterestTag": true,

    "interestTagUrl": [],
    "interestTagUrlDefaultImpact": 2,
    "mergeInterestTagUrl": true,

    "uninterestingTagUrl": [
        "admin",
        "cart",
        "checkout",
        "favorite",
        "password",
        "register",
        "registration",
        "sendfriend",
        "wishlist,",
        "signin",
        "login",
        "cgi-bin",
        "includes",
        "var,",
        "filter",
        "limit",
        "order",
        "sort,",
        "sessionid",
        "session_id",
        "SID",
        "PHPSESSID",
        "add"
    ],
    "uninterestingTagUrlDefaultImpact": -2,
    "mergeUninterestTagUrl": true,

    "searchTags" : [
        "foo", "bar", "crawler"
    ],
    "maxCombinationSearchTags": 0,
    "offsetMaxSearchEngine": 100,
    "searchEngineLanguage": "uk-en"
}
```

> searchEngineLanguage option [here](https://duckduckgo.com/params)

## Plugin
You can add plugins, just add them in `/app/src/plugins/` folder in the container.
Your plugins files should start with 'Plugin' (ex: 'PluginTest.js').
You can add other file in plugins folder and import them into your plugin, they will not be used.

There is a template for your plugin: 
```javascript
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
        this.setNewLink = this.setNewLink.bind(this);
        this.onNewLink = this.onNewLink.bind(this);
    }

    /**
     * After the crawler is initialized
     */
    onInit() {
        this.log("init");
    }

    /**
     * Before the crawler start
     */
    onStart() {}

    /**
     * When stop is send to the crawler
     */
    onStop() {}
    
    /**
     * Before a page was fetched
     * @param {string} url - page url
     */
    onFetchPage(url) {}

    /**
     * To force the match of an page
     * @param page - The pupeeter page instance
     * @param config - The config (config.json)
     * @param url - The page url
     * @return {{match, matchTags}} match - NB: the page will be marked as match=true, if one or more plugins return true
     */
    match( page, config, url ) {
        return {
            match: false,
            matchTags: []
        };
    }

    /**
     * After an page was fetched
     * @param {boolean} pageData.match - if the page was matched or not
     * @param {Array<string>} pageData.matchTags - the matched tags
     * @param {string} pageData.language - the page language
     * @param {Array<linkObject>} pageData.links - An object with the key {href, domain, texts, interestScore} for each link in fetched page
     * @param {string} pageData.url - page url
     */
    onPageIsFetched(pageData) {}

    /**
     * Before recover the new link. You can return a new url to fetch
     * NB: If you have multiple plugin with multiple 'onGetNewLink', i can't predict which plugin will be selected.
     * @param {Array<linkObject>} previousFetchedPage - the links fetch in the previous crawled page
     * @return {string|null} return the futur page to fetch
     */
    setNewLink(previousFetchedPage) { return null; }

    /**
     * After recover the new link to fetch
     * @param {string} newUrl - the new url fetched
     */
    onNewLink(newUrl) {}

}

module.exports = PluginTest;

/**
 * @typedef linkObject
 * @property {number} interestScore - calculated score of this link
 * @property {string} href - the url
 * @property {string} domain - the domain of this url
 * @property {Array<string>} texts - array of each text who accompanied this link
 */
```

>  - Every Crawler will have an instance of your plugins.
>
>  - You can use [lodash](https://lodash.com/docs), 
[bluebird](http://bluebirdjs.com/), 
or [axios](https://github.com/axios/axios) in your plugin
>
> - Every method can be **async**
>
> - You can also use `this.log(..texts)`, 
it's a specific log who print dateTime and crawler ID


## Known Issue
- An container of devtools image, cannot be re-launched if
the container has not been down before

## ToDo
- make a beautiful readMe
- add more complexe exemple
- correct english of readme
- tag first stable version
- re-fetch timeout page, after few days
- optimise mongo get new link

## Authors
- **Eden Cadagiani** ([HelloMyBot](https://hellomybot.io/fr/bienvenue/))

## License
This project is licensed under the Apache 2.0 - see the [LICENSE](LICENSE) file for details
