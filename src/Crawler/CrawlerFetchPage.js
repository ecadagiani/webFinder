const { chain, get, uniq, head } = require( 'lodash' );
const { wait, getUrlParts } = require( '@ecadagiani/jstools' );

const { basicNavigationErrorCode, searchEngineDomain, crawlerStatusType } = require( '../constants/crawlerconstants' );
const { calculInterestScore } = require( './calculInterest' );
const { getDomain } = require( '../lib/tools' );

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
                domain: values[0].hostname,
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


async function getPageLanguage( page, url, { interestLanguage } ) {
    if ( getDomain( url ) === searchEngineDomain )
        return head( interestLanguage );

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
        language: await getPageLanguage( this.page, url, this.config ),
        links: await fetchLinks( this.page, this.config ),
    } );
}

async function __tryToFetchPage( page, errorCount = 0 ) {
    if ( this.status === crawlerStatusType.stopping ) {
        await this.mongoManager.updatePage( { _id: page._id, fetched: false });
        await this.__stopNext();
        return;
    }
    if ( this.status === crawlerStatusType.stopped ) {
        return;
    }

    let fetchedPages = [];
    try {
        fetchedPages = await this.fetchPage( page );
    } catch ( err ) {
        if ( this.config.throwError ) throw err;

        if ( err.code === 6001 ) { // Domain recovery failed
            this.logError( `error on fetch - ${err.message}` );
            return [];
        }

        if ( Object.values( basicNavigationErrorCode ).some( errorCode => err.message.includes( errorCode ) ) ) {
            await this.mongoManager.insertPage( { _id: page._id, fetched: true } );
            return [];
        }

        if ( errorCount < this.config.maxErrorFetchPage - 1 ) {
            this.logError( `error on fetch (${errorCount + 1}) - ${err.message}` );

            if ( err.message.includes( 'browser has disconnected' ) ) {
                await this.initBrowser();
                await this.initPage();
            } else if ( err.message.includes( 'Execution context was destroyed' ) ) {
                await this.initPage();
            } else if ( err.message.includes( 'Session closed' ) ) {
                await this.initPage();
            } else if ( err.message.includes( 'Connection closed' ) ) {
                await this.initPage();
            } else if( errorCount === this.config.maxErrorFetchPage - 2 ) {
                // last error we try to restart browser
                await this.initBrowser();
                await this.initPage();
            }

            return await this.__tryToFetchPage( page, errorCount + 1 );
        }

        this.logError( `error on fetch (${errorCount + 1}) - ${err.message}` );
        await this.mongoManager.updatePage(
            { _id: page._id, fetched: false, error: true, errorMessage: err.toString() },
            { addOneToDomain: true }
        );
        // is mandatory to add one to domain, to avoid to crawl bugged domain indefinitely
    }
    return fetchedPages || [];
}


async function fetchPage( page ) {
    // access to the page and set page fetching
    await this.__runPlugins( 'onFetchPage', page );

    this.logTime( 'time to navigate' );
    await Promise.all( [
        this.page.waitForNavigation( {
            waitUntil: ['load', 'domcontentloaded'],
            timeout: this.config.waitForPageLoadTimeout
        } ),
        this.page.goto( page.url ),
    ] );

    if ( this.config.waitForBodyAppear ) {
        // wait for body appear (5sec max), and min 1 sec
        await Promise.all( [
            this.page.waitForSelector( 'body', { timeout: this.config.timeoutForBodyAppear } ),
            wait( 500 ),
        ] );
    }
    this.logTimeEnd( 'time to navigate' );

    // fetch DOM data
    this.logTime( 'time to fetch page data' );
    let pageData = await this._fetchPageData( page.url );
    this.logTimeEnd( 'time to fetch page data' );

    // calculate links score
    this.logTime( 'time to calculate links score' );
    const links = await Promise.map( pageData.links || [], async link => ({
        ...link,
        interestScore: await calculInterestScore( link.href, link.domain, link.texts, pageData.language, this.config ),
    }) );
    this.logTimeEnd( 'time to calculate links score' );

    await this.__runPlugins( 'onPageIsFetched', { ...pageData, links, ...page } );

    // save all data
    this.logTime( 'time to save fetchData in mongo' );
    await this.mongoManager.updatePage({
        ...pageData,
        _id: page._id,
        fetched: true,
        fetchDate: Date.now(),
    }, {
        addOneToDomain: true
    });

    const discoveredPages = await Promise.map( links, ( link ) =>
        this.mongoManager.insertPage( {
            url: link.href,
            domain: link.domain,
            fetchInterest: link.interestScore,
        }, {
            saveDomain: true
        })
    );

    this.logTimeEnd( 'time to save fetchData in mongo' );
    return discoveredPages;
}

module.exports = {
    __tryToFetchPage, fetchPage, _fetchPageData
};
