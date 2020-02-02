const { get, chain, template, uniq, find } = require( 'lodash' );
const { getRndInteger, drawWithoutDuplicate } = require( '@ecadagiani/jstools' );
const { searchEngineUrl, crawlerStatusType } = require( '../constants/crawlerconstants' );

async function __tryToGetNewPage( previousDiscoveredPages = [], errorCount = 0 ) {
    if ( this.status === crawlerStatusType.stopping ) {
        await this.__stopNext();
        return;
    }
    if ( this.status === crawlerStatusType.stopped ) {
        return;
    }

    let page = null;
    try {
        page = await this.__getNewPage( previousDiscoveredPages );
    } catch ( err ) {
        if ( this.config.throwError ) throw err;

        if ( errorCount < this.config.maxErrorGetNewLink - 1 ) {
            this.logError( `error on get next link (${errorCount + 1}) - ${err.message}` );
            return await this.__tryToGetNewPage( previousDiscoveredPages, errorCount + 1 );
        }

        throw this.error( 'error on get next link - ', err.message );
    }

    return page;
}


async function __getNewPage( previousDiscoveredPages = [] ) {

    /* process by PLUGIN -------------------- */
    const pluginsNewLink = await this.__runPlugins( 'setNewLink', previousDiscoveredPages );
    const pluginNewUrl = find( pluginsNewLink || [], url => typeof url === 'string' );
    if ( pluginNewUrl ) {
        this.logDebug( 'new link resolved by plugin: ', pluginNewUrl );
        return {url: pluginNewUrl};
    }


    let futurPage = null;
    /* process by PREVIOUS PAGE -------------------- */
    futurPage = await this.mongoManager.getNewLinkFromPreviousPage(
        previousDiscoveredPages, this.config.interestMinimumScoreToContinue
    );
    // if we have fetched a link with a correct score (interestMinimumScoreToContinue), we return this
    if ( get( futurPage, 'url' ) ) {
        this.logDebug( 'New link resolved by previous links: ', futurPage );
        return futurPage;
    }


    /* process by BEST PAGE FROM MONGO -------------------- */
    // if we have zero valid links, we get new link from mongo, but with a decent score (interestMinimumScoreToFetchDb)
    futurPage = await this.mongoManager.getNewLinkFromMongoPage( this.config.interestMinimumScoreToFetchDb );
    if ( get( futurPage, 'url' ) ) {
        this.logDebug( 'New link resolved by best page from mongo: ', futurPage );
        return futurPage;
    }


    /* process by SEARCH ENGINE -------------------- */
    const searchEngineUrl = this.__getRandomSearchEngineUrl();
    const searchEnginePage = await this.mongoManager.getPage( searchEngineUrl );
    // if duckduckgo links is not present in mongo or if it was fetched more than 15 days ago
    if ( !searchEnginePage) {
        this.logDebug( 'New link resolved by search link: ', searchEngineUrl );
        return {url: searchEngineUrl};
    } else if(Date.now() - (get( searchEnginePage, 'fetchDate' ) || new Date()).getTime() > 15 * 24 * 60 * 60 * 1000) {
        this.logDebug( 'New link resolved by search link: ', searchEnginePage );
        return searchEnginePage;
    }


    /* process by PAGE FROM MONGO -------------------- */
    // if searchEngine link have already been fetch, we get link from mongo without decent score
    futurPage = await this.mongoManager.getNewLinkFromMongoPage();
    if ( get( futurPage, 'url' ) ) {
        this.logDebug( 'New link resolved by page from mongo: ', futurPage );
        return futurPage;
    }

    return null;
}


function __getRandomSearchEngineUrl() {
    const { searchTags, maxCombinationSearchTags, offsetMaxSearchEngine, searchEngineLanguage } = this.config;
    const nbTagsToDraw = getRndInteger(
        1,
        searchTags.length < maxCombinationSearchTags ? searchTags.length : maxCombinationSearchTags
    );

    const resTags = drawWithoutDuplicate( searchTags, nbTagsToDraw );
    const offset = getRndInteger( 0, Math.round( offsetMaxSearchEngine / 10 ) ) * 10;
    let url = null;
    try {
        const compiled = template( searchEngineUrl );
        url = compiled( {
            query: resTags.join( '+' ),
            language: searchEngineLanguage,
            offset
        } );
    } catch ( err ) {
        if ( this.config.throwError )
            throw err;
        return null;
    }
    return url;
}

module.exports = {
    __tryToGetNewPage, __getRandomSearchEngineUrl, __getNewPage,
};
