const {testArrayOfString} = require('../lib/tools');
const {getRndInteger} = require('@ecadagiani/jstools');

function calculInterestScore(url, domain, linkTexts, pageLanguage, config) {
    const {
        interestLanguage, interestLanguageImpact, uninterestLanguageImpact,
        interestTag, uninterestingTag, interestTagUrl, uninterestingTagUrl,
        interestTagImpact, uninterestingTagImpact, interestTagUrlImpact, uninterestingTagUrlImpact,
        interestRandRange,
    } = config;
    let score = 0;

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
