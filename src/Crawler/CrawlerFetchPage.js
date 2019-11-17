const { chain, get, uniq } = require( 'lodash' );
const { wait, getUrlParts } = require( '@ecadagiani/jstools' );

const { basicNavigationErrorCode } = require( '../constants/crawlerconstants' );
const { calculInterestScore } = require( './calculInterest' );

async function fetchLinks( page, { domainWhitelist, crawlInvisibleLink, authorizedLinksExtensions, maxUrlLength, authorizedURIScheme } ) {
    let links = await page.evaluate( () => {// get href and texts
        const anchors = document.querySelectorAll( 'a' );
        return Array.from( anchors )
            .filter( anchor => !!anchor.href )
            .map( anchor => ({
                href: anchor.href,
                texts: [anchor.textContent],
                invisible: (anchor.offsetParent === null)
            }) );
    } );

    links = chain( links )
        .map( link => { // add url parts for next step
            const urlParts = getUrlParts( link.href );
            if ( urlParts ) return { ...link, ...getUrlParts( link.href ) };
            else return { ...link, invalid: true };
        } )
        .filter( ( { href, domain, extension, uriScheme, invisible, invalid } ) => {
            // remove domainWhitelist, invisble link (depend to config), very long url, non supported uriScheme (ex: mailto:), non supported extension (ex: .png)
            if ( invalid ) return false;

            if ( href.length > maxUrlLength ) return false;
            if ( !crawlInvisibleLink && invisible ) return false;
            if ( domainWhitelist.some( whitelisted => domain === whitelisted ) ) return false;
            if ( !authorizedURIScheme.includes( uriScheme ) ) return false;
            if ( extension && !authorizedLinksExtensions.includes( extension ) ) return false;

            return true;
        } )
        .groupBy( 'href' )
        .mapValues( ( values, key ) => {
            return {
                href: key,
                domain: values[0].domain,
                texts: chain( values )
                    .map( x => x.texts )
                    .flattenDeep()
                    .filter( x => x.trim() !== '' )
                    .uniq()
                    .value()
            };
        } )
        .values()
        .value();
    return links;
}


async function checkSearchSelectors( page, { searchSelectors } ) {
    const result = await page.evaluate( ( selectors = [] ) => {
        const matchedSelectors = selectors.filter( ( { selector } ) => !!document.querySelector( selector ) );
        return {
            match: matchedSelectors.length > 0,
            matchTags: matchedSelectors.map( ( { tag } ) => tag )
        };
    }, searchSelectors );
    return result;
}


async function getPageLanguage( page ) {
    return await page.evaluate( () => {
        return document.documentElement.lang;
    } );
}

async function _fetchPageData( url ) {
    const getMatch = async () => {
        const [
            { match: matchSelectors, matchTags: matchTagsSelectors },
            pluginMatchs
        ] = await Promise.all( [
            checkSearchSelectors( this.page, this.config ),
            this.__runPlugins( 'match', this.page, this.config, url )
        ] );

        const match = matchSelectors || !!(pluginMatchs || []).find( x => get( x, 'match', false ) );
        const matchTagsPlugins = chain( pluginMatchs || [] )
            .filter( x => get( x, 'match', false ) )
            .map( ( { matchTags } ) => matchTags )
            .flatten()
            .value();
        const matchTags = uniq( [...matchTagsSelectors, ...matchTagsPlugins] );

        return {
            match, matchTags
        };
    };

    return Promise.props( {
        // match,
        // matchTags,
        ...await getMatch(),
        language: await getPageLanguage( this.page ),
        links: await fetchLinks( this.page, this.config ),
    } );
}

async function __tryToFetchPage( url, errorCount = 0 ) {
    this.log( `fetch - ${url}` );
    let fetchedPages = [];
    try {
        fetchedPages = await this.fetchPage( url );
    } catch ( err ) {
        if ( this.config.throwError ) throw err;

        if ( err.code === 6001 ) { // Domain recovery failed
            this.logError( `error on fetch - ${err.message}` );
            return null;
        }
        if ( errorCount < 2 ) {
            this.logError( `error on fetch (${errorCount + 1}) - ${err.message}` );
            this.log( 'will try again' );
            await this.__runningReinit();
            return await this.__tryToFetchPage( url, errorCount + 1 );
        }

        this.logError( `error on fetch (${errorCount + 1}) - ${err.message}` );
        await this.mongoManager.createOrUpdatePage( {
            url, error: true, fetched: false, fetching: false, errorMessage: err.toString()
        } );
    }
    return fetchedPages || [];
}


async function fetchPage( url ) {
    // access to the page and set page fetching

    this.logTime( 'time to navigate' );
    try {
        await Promise.all( [
            this.mongoManager.createOrUpdatePage( { url, fetching: true }, { saveDomain: true } ),
            this.page.waitForNavigation( {
                waitUntil: ['load', 'domcontentloaded'],
                timeout: this.config.waitForPageLoadTimeout
            } ), // , 'domcontentloaded'
            this.page.goto( url ),
        ] );
    } catch ( err ) {
        if (
            Object.values( basicNavigationErrorCode ).some( errorCode => err.message.includes( errorCode ) )
        ) {
            await this.mongoManager.createOrUpdatePage( { url, fetched: true, fetching: false } );
            return null;
        }
        throw err;
    }

    // wait for body appear (5sec max), and min 1 sec
    await Promise.all( [
        this.page.waitForSelector( 'body', { timeout: 5000 } ),
        wait( 1000 ),
    ] );
    this.logTimeEnd( 'time to navigate' );

    // fetch DOM data
    this.logTime( 'time to fetch page data' );
    let pageData = await this._fetchPageData( url );
    this.logTimeEnd( 'time to fetch page data' );

    // calculate links score
    this.logTime( 'time to calculate links score' );
    const links = await Promise.map( pageData.links || [], async link => ({
        ...link,
        interestScore: await calculInterestScore( link.href, link.domain, link.texts, pageData.language, this.config ),
    }) );
    this.logTimeEnd( 'time to calculate links score' );

    await this.__runPlugins( 'onPageIsFetched', { ...pageData, links, url } );

    // save all data
    this.logTime( 'time to save data in mongo' );
    const pages = [
        {
            data: {
                url,
                match: pageData.match,
                matchTags: pageData.matchTags,
                language: pageData.language,
                fetched: true,
                fetching: false,
                fetchDate: Date.now()
            },
            options: {
                addOneToDomain: true
            }
        },
        ...links.map( link => ({
            data: {
                url: link.href,
                domain: link.domain,
                fetchInterest: link.interestScore,
            }
        }) ),
    ];
    await Promise.map( pages, ( { data, options } ) => this.mongoManager.createOrUpdatePage( data, options ) );
    this.logTimeEnd( 'time to save data in mongo' );
    return pages;
}

module.exports = {
    __tryToFetchPage, fetchPage, _fetchPageData
};
