const {concat} = require('lodash');

function initConfig(userConfig, defaultConfig) {
    const config = {
        ...defaultConfig,
        ...userConfig
    };

    config.domainWhitelist = config.mergeDomainWhitelist ? concat(userConfig.domainWhitelist, defaultConfig.domainWhitelist) : config.domainWhitelist;
    config.interestTag = config.mergeInterestTag ? concat(userConfig.interestTag, defaultConfig.interestTag) : config.interestTag;
    config.uninterestingTag = config.mergeUninterestTag ? concat(userConfig.uninterestingTag, defaultConfig.uninterestingTag) : config.uninterestingTag;
    config.interestTagUrl = config.mergeInterestTagUrl ? concat(userConfig.interestTagUrl, defaultConfig.interestTagUrl) : config.interestTagUrl;
    config.uninterestingTagUrl = config.mergeUninterestTagUrl ? concat(userConfig.uninterestingTagUrl, defaultConfig.uninterestingTagUrl) : config.uninterestingTagUrl;
    return config;
}

module.exports = {initConfig};
