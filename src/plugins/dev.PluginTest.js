const CrawlerPlugin = require( '../lib/CrawlerPlugin' );

class PluginTest extends CrawlerPlugin {

    constructor( ...params ) {
        super( ...params );
        this.onInit = this.onInit.bind( this );
        this.onStart = this.onStart.bind( this );
        this.onStop = this.onStop.bind( this );
        this.onFetchPage = this.onFetchPage.bind( this );
        this.match = this.match.bind( this );
        this.onPageIsFetched = this.onPageIsFetched.bind( this );
        this.setNewLink = this.setNewLink.bind( this );
        this.onNewLink = this.onNewLink.bind( this );
    }

    /**
     * After the crawler is initialized
     */
    onInit() {
    }

    /**
     * Before the crawler start
     */
    async onStart() {
    }

    /**
     * When stop is send to the crawler
     */
    onStop() {
    }

    /**
     * Before a page was fetched
     * @param {Object} page - page page
     */
    onFetchPage( page ) {
    }

    /**
     * To force the match of an page
     * @param page - The pupeeter page instance
     * @param config - The config (config.json)
     * @param url - The page url
     * @return {{match, matchTags}} match - NB: the page will be marked as match=true, if one or more plugins return true
     */
    match( page, config, url ) {
    }

    /**
     * After an page was fetched
     * @param {boolean} pageData.match - if the page was matched or not
     * @param {Array<string>} pageData.matchTags - the matched tags
     * @param {string} pageData.language - the page language
     * @param {string} pageData.url - the page url
     * @param {string} pageData._id - the page id
     * @param {Array<linkObject>} pageData.links - An object with the key {href, domain, texts, interestScore} for each link in fetched page
     */
    async onPageIsFetched( pageData ) {
    }

    /**
     * Before recover the new link. You can return a new url to fetch
     * NB: If you have multiple plugin with multiple 'onGetNewLink', i can't predict which plugin will be selected.
     * @param {Array<linkObject>} previousFetchedPage - the links fetch in the previous crawled page
     * @return {string|null} return the futur page to fetch
     */
    setNewLink( previousFetchedPage ) {
        return null;
    }

    /**
     * After recover the new link to fetch
     * @param {Object} newPage - the new page fetched
     */
    onNewLink( newPage ) {
    }
}

module.exports = PluginTest;

/**
 * @typedef linkObject
 * @property {number} interestScore - calculated score of this link
 * @property {string} href - the url
 * @property {string} domain - the domain of this url
 * @property {Array<string>} texts - array of each text who accompanied this link
 */
