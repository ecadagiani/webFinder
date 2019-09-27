const {get, find} = require('lodash');
const {getRndInteger, testArrayOfString} = require('../lib/tools');

function calculInterestScore(url, domain, linkTexts, pageLanguage, domainsUsage, config) {
    const {
        minimumDomainRepetitionCrawlerTrap, domainRepetitionImpactFunction,
        interestLanguage, interestLanguageImpact, uninterestLanguageImpact,
        interestTag, uninterestingTag, interestTagUrl, uninterestingTagUrl,
        interestTagImpact, uninterestingTagImpact, interestTagUrlImpact, uninterestingTagUrlImpact,
        interestRandRange,
    } = config;
    let score = 0;


    // domain repetition ( to detect crawler trap )
    const findDomainUsage = find(domainsUsage, {domain});
    if(get(findDomainUsage, 'count') > minimumDomainRepetitionCrawlerTrap) {
        const fn = eval(domainRepetitionImpactFunction);
        score = fn(findDomainUsage.count, score);
    }


    // language
    if( interestLanguage.includes(pageLanguage) )
        score += interestLanguageImpact;
    else
        score += uninterestLanguageImpact;


    // interestUrl
    if(testArrayOfString(interestTagUrl, url)) //todo each match impact score and each tag can have a specific impact
        score += interestTagUrlImpact;
    if(testArrayOfString(uninterestingTagUrl, url))
        score += uninterestingTagUrlImpact;

    // interest
    if( linkTexts.some(text => testArrayOfString(interestTag, text)) )
        score += interestTagImpact;
    if( linkTexts.some(text => testArrayOfString(uninterestingTag, text)) )
        score += uninterestingTagImpact;

    // rand
    score += getRndInteger(interestRandRange.min, interestRandRange.max); // add some random

    return score;
}


module.exports = {calculInterestScore};
