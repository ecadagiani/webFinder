const { get, chain, template, uniq, find } = require( 'lodash' );
const { getRndInteger, drawWithoutDuplicate } = require( '@ecadagiani/jstools' );
const { searchEngineUrl } = require( '../constants/crawlerconstants' );

async function __tryToGetNewLink( previousFetchedPage, errorCount = 0 ) {
    let url = null;
    try {
        url = await this.__getNewLink( previousFetchedPage );
    } catch ( err ) {
        if ( this.__doIhaveToStop() ) return;
        if ( this.config.throwError )
            throw err;
        if ( errorCount < 2 ) {
            await this.__runningReinit();
            return await this.__tryToGetNewLink( previousFetchedPage, errorCount + 1 );
        }
        throw this.error( 'error on get next link - ', err.message );
    }

    return url;
}


async function __getNewLink( previousFetchedPage = [] ) {

    /* process by PLUGIN -------------------- */
    const pluginsNewLink = await this.__runPlugins( 'setNewLink', previousFetchedPage );
    const pluginNewUrl = find( pluginsNewLink || [], url => typeof url === 'string' );
    if ( pluginNewUrl ) {
        this.logDebug( 'new link resolved by plugin: ', pluginNewUrl );
        return pluginNewUrl;
    }

    /* process by PREVIOUS PAGE -------------------- */
    let futurPage = null;

    // Prepare previous Page
    const mongoPreviousPage = await this.mongoManager.getPreviousPagesData( previousFetchedPage.map( ( { url } ) => url ) );
    futurPage = chain( mongoPreviousPage )
        .filter( page => page.score > this.config.interestMinimumScoreToContinue )
        .head()
        .value();

    // if we have fetched a link with a correct score (interestMinimumScoreToContinue), we return this
    if ( get( futurPage, 'url' ) ) {
        this.logDebug( 'New link resolved by previous links: ', futurPage );
        return futurPage.url;
    } else if ( this.config.debug ) { // log debug
        this.logDebug( 'The best previous page, did not have a sufficient score, his score was: ',
            get(mongoPreviousPage, '0.score')
        );
    }

    /* process by BEST PAGE FROM MONGO -------------------- */
    // if we have zero valid links, we get new link from mongo, but with a decent score (interestMinimumScoreToFetchDb)
    futurPage = await this.mongoManager.getBestPageToFetch( this.config.interestMinimumScoreToFetchDb );
    if ( get( futurPage, 'url' ) ) {
        this.logDebug( 'New link resolved by best page from mongo: ', futurPage );
        return futurPage.url;
    }


    /* process by SEARCH ENGINE -------------------- */
    const searchEngineLink = this.__getRandomSearchEngineLink();
    const searchEngineLinkMongo = await this.mongoManager.getPage( searchEngineLink );
    // if duckduckgo links is not present in mongo or if it was fetched more than 15 days ago
    if (
        !searchEngineLinkMongo
        || Date.now() - (get( searchEngineLinkMongo, 'fetchDate' ) || new Date()).getTime() > 15 * 24 * 60 * 60 * 1000
    ) {
        this.logDebug( 'New link resolved by search link: ', searchEngineLink );
        return searchEngineLink;
    }


    /* process by PAGE FROM MONGO -------------------- */
    // if searchEngine link have already been fetch, we get link from mongo without decent score
    futurPage = await this.mongoManager.getBestPageToFetch();
    if ( get( futurPage, 'url' ) ) {
        this.logDebug( 'New link resolved by page from mongo: ', futurPage );
        return futurPage.url;
    }

    return null;
}


function __getRandomSearchEngineLink() {
    const { searchTags, maxCombinationSearchTags, offsetMaxSearchEngine } = this.config;
    const nbTagsToDraw = getRndInteger(
        1,
        searchTags.length < maxCombinationSearchTags ? searchTags.length : maxCombinationSearchTags
    );

    const resTags = drawWithoutDuplicate( searchTags, nbTagsToDraw );
    const offset = getRndInteger( 0, Math.round( offsetMaxSearchEngine / 10 ) ) * 10;
    let url = null;
    try {
        const compiled = template( searchEngineUrl );
        url = compiled( { query: resTags.join( '+' ), offset } );
    } catch ( err ) {
        if ( this.config.throwError )
            throw err;
        return null;
    }
    return url;
}

module.exports = {
    __tryToGetNewLink, __getRandomSearchEngineLink, __getNewLink,
};
