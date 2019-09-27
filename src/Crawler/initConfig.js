const {concat} = require('lodash');


function initConfig(userConfig, defaultConfig) {
    const config = {
        ...defaultConfig,
        ...userConfig
    };

    function mergeConfigArray(arrayKey, doMerge) {
        config[arrayKey] = doMerge ? concat(userConfig[arrayKey], defaultConfig[arrayKey]) : config[arrayKey];
    }
    mergeConfigArray('authorizedLinksExtensions', config.mergeAuthorizedLinksExtensions);
    mergeConfigArray('authorizedURIScheme', config.mergeAuthorizedURIScheme);
    mergeConfigArray('domainWhitelist', config.mergeDomainWhitelist);
    mergeConfigArray('interestTag', config.mergeInterestTag);
    mergeConfigArray('uninterestingTag', config.mergeUninterestTag);
    mergeConfigArray('interestTagUrl', config.mergeInterestTagUrl);
    mergeConfigArray('uninterestingTagUrl', config.mergeUninterestTagUrl);
    return config;
}

module.exports = {initConfig};
