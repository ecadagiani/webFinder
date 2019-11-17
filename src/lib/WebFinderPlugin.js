class WebFinderPlugin {
    constructor( crawler ) {
        this.__crawler = crawler;
        this.log = this.log.bind( this );
    }

    log( ...texts ) {
        const date = new Date();
        console.log( `[${date.toISOString()}] Crawler ${this.__crawler.id} - Plugin: `, ...texts );
    }

    /**
     * After the crawler is initialized
     */
    onInit() {
    }

    /**
     * Before the crawler start
     */
    onStart() {
    }

    /**
     * When crawler stop
     */
    onStop() {
    }

    /**
     * Before a page was fetched
     * @param {string} url - page url
     */
    onFetchPage( url ) {
    }

    /**
     * To force the match of an page
     * @param page - The pupeeter page instance
     * @param config - The config (config.json)
     * @return {{match, matchTags}} match - NB: the page will be marked as match=true, if one or more plugins return true
     */
    match( page, config ) {
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
     */
    onPageIsFetched( pageData ) {
    }

    /**
     * Before recover the new link. You can return a new url to fetch
     * PS: If you have multiple plugin with multiple 'onGetNewLink', i can't predict which plugin will be selected.
     * @param {Array<linkObject>} previousFetchedPage - the links fetch in the previous crawled page
     * @return {string|null} return the futur page to fetch
     */
    onGetNewLink( previousFetchedPage ) {
        return null;
    }

    /**
     * After recover the new link to fetch
     * @param {string} newUrl - the new url fetched
     */
    onNewLink( newUrl ) {
    }

}

module.exports = WebFinderPlugin;

/**
 * @typedef linkObject
 * @property {number} interestScore - calculated score of this link
 * @property {string} href - the url
 * @property {string} domain - the domain of this url
 * @property {Array<string>} texts - array of each text who accompanied this link
 */
