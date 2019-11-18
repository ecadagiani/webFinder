const { get, chain, template, uniq, find } = require( 'lodash' );
const { getRndInteger, drawWithoutDuplicate } = require( '@ecadagiani/jstools' );

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

    // Plugin
    const pluginsNewLink = await this.__runPlugins( 'setNewLink', previousFetchedPage );
    const pluginNewUrl = find( pluginsNewLink || [], url => typeof url === 'string' );
    if ( pluginNewUrl ) {
        this.logDebug( 'new link resolved by plugin: ', pluginNewUrl );
        return pluginNewUrl;
    }

    // Get Domain Score
    const allDomains = uniq( previousFetchedPage.map( x => x.domain ).filter( x => !!x ) );
    const domainsDb = await Promise.map( allDomains, domain => this.mongoManager.getDomain( domain ) );
    const domainScore = domainsDb
        .filter( x => !!x )
        .reduce( ( obj, domain ) => {
            obj[domain.domain] = domain.score;
            return obj;
        }, {} );

    let futurPage = null;

    // Prepare previous Page
    const mongoPreviousPage = await this.mongoManager.getPages( previousFetchedPage.map( ( { url } ) => url ) );
    futurPage = chain( mongoPreviousPage )
        .map( page => ({
            fetched: page.fetched,
            fetching: page.fetched,
            url: page.url,
            score: page.fetchInterest + (get( domainScore, page.domain ) || 0),
        }) )
        .filter( page =>
            !page.fetching && !page.fetched
            && page.score > this.config.interestMinimumScoreToContinue
        )
        .orderBy( ['score'], ['desc'] )
        .head()
        .value();

    // if we have fetched a link with a correct score (interestMinimumScoreToContinue), we return this
    if ( get( futurPage, 'url' ) ) {
        this.logDebug( 'new link resolved by previous links: ', futurPage );
        return futurPage.url;
    }

    // if we have zero valid links, we get new link from mongo, but with a decent score (interestMinimumScoreToFetchDb)
    futurPage = await this.mongoManager.getBestPageToFetch( this.config.interestMinimumScoreToFetchDb );
    if ( get( futurPage, 'url' ) ) {
        this.logDebug( 'new link resolved by best page from mongo: ', futurPage );
        return futurPage.url;
    }


    // if we don't have a decent link in mongo, we find new links with config searchEngineUrl
    if ( this.config.searchEngineUrl ) {
        const searchEngineLink = this.__getRandomSearchEngineLink();
        const searchEngineLinkMongo = await this.mongoManager.getPage( searchEngineLink );
        // if duckduckgo links is not present in mongo or if it was fetched more than 15 days ago
        if (
            !searchEngineLink
            || Date.now() - (get( searchEngineLinkMongo, 'fetchDate' ) || new Date()).getTime() > 15 * 24 * 60 * 60 * 1000
        ) {
            this.logDebug( 'new link resolved by search link: ', searchEngineLink );
            return searchEngineLink;
        }
    }


    // if searchEngine link have already been fetch, we get link from mongo without decent score
    futurPage = await this.mongoManager.getBestPageToFetch();
    if ( get( futurPage, 'url' ) ) {
        this.logDebug( 'new link resolved by page from mongo: ', futurPage );
        return futurPage.url;
    }

    return null;
}


function __getRandomSearchEngineLink() {
    const { searchTags, maxCombinationSearchTags } = this.config;
    const nbTagsToDraw = getRndInteger(
        1,
        searchTags.length < maxCombinationSearchTags ? searchTags.length : maxCombinationSearchTags
    );

    const resTags = drawWithoutDuplicate( searchTags, nbTagsToDraw );

    let url = null;
    try {
        const compiled = template( this.config.searchEngineUrl );
        url = compiled( { query: resTags.join( '+' ) } );
    } catch ( e ) {
        return null;
    }
    return url;
}

module.exports = {
    __tryToGetNewLink, __getRandomSearchEngineLink, __getNewLink,
};
