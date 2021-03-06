const { concat, chain } = require( 'lodash' );
const { searchEngineDomain } = require( '../constants/crawlerconstants' );


function initConfig( userConfig, defaultConfig ) {
    const config = {
        ...defaultConfig,
        ...userConfig,
        mongo: {
            ...defaultConfig.mongo,
            ...userConfig.mongo,
        },
        browserOptions: {
            ...defaultConfig.browserOptions,
            ...(userConfig.browserOptions || {}),
        }
    };

    const configFunction = eval( config.domainScoreFunction );
    config.domainScoreFunction = ( domain, nbFetch ) => {
        if ( domain === searchEngineDomain )
            return 0;
        return configFunction( domain, nbFetch );
    };

    function mergeConfigArray( arrayKey, doMerge ) {
        config[arrayKey] = doMerge ? concat( userConfig[arrayKey], defaultConfig[arrayKey] ) : config[arrayKey];
    }


    function mergeConfigTagArray( arrayKey, doMerge, defaultImpact ) {
        mergeConfigArray( arrayKey, doMerge );
        config[arrayKey] = chain( config[arrayKey] )
            .map( x => {
                if ( typeof x === 'string' )
                    return { tag: x, impact: defaultImpact };
                else if ( typeof x === 'object' && x.tag ) {
                    return { tag: x.tag, impact: x.impact || defaultImpact };
                }
                return null;
            } )
            .filter( x => !!x )
            .uniqBy( 'tag' )
            .value();
    }

    mergeConfigArray( 'authorizedLinksExtensions', config.mergeAuthorizedLinksExtensions );
    mergeConfigArray( 'authorizedURIScheme', config.mergeAuthorizedURIScheme );
    mergeConfigArray( 'domainWhitelist', config.mergeDomainWhitelist );
    mergeConfigTagArray( 'interestTag', config.mergeInterestTag, config.interestTagDefaultImpact );
    mergeConfigTagArray( 'uninterestingTag', config.mergeUninterestTag, config.uninterestingTagDefaultImpact );
    mergeConfigTagArray( 'interestTagUrl', config.mergeInterestTagUr, config.interestTagUrlDefaultImpact );
    mergeConfigTagArray( 'uninterestingTagUrl', config.mergeUninterestTagUrl, config.uninterestingTagUrlDefaultImpact );
    return config;
}

module.exports = { initConfig };
