const {getRndInteger} = require('@ecadagiani/jstools');


async function calculTagsArrayScore(tagsArray, text){
    return await Promise.reduce(tagsArray, (totalScore, {tag, impact}) => {
        const reg = new RegExp(tag, 'i');
        if(reg.test(text))
            return totalScore + impact;
        return totalScore;
    }, 0);
}

async function calculInterestScore(url, domain, linkTexts, pageLanguage, config) {
    const {
        interestLanguage, interestLanguageImpact, uninterestLanguageImpact,
        interestTag, uninterestingTag, interestTagUrl, uninterestingTagUrl,
        interestRandRange,
    } = config;
    let score = 0;

    // language
    if( interestLanguage.includes(pageLanguage) )
        score += interestLanguageImpact;
    else
        score += uninterestLanguageImpact;


    // interestUrl
    score += await calculTagsArrayScore(interestTagUrl, url);
    score += await calculTagsArrayScore(uninterestingTagUrl, url);

    // interest
    score += await Promise.reduce(linkTexts, async (totalScore, text) => {
        return totalScore
            + await calculTagsArrayScore(interestTag, text)
            + await calculTagsArrayScore(uninterestingTag, text);
    }, 0);

    // rand
    const {min, max } = interestRandRange || {};
    if(min === 'number' && max === 'number' && min !== max)
        score += getRndInteger(interestRandRange.min, interestRandRange.max); // add some random

    return score;
}


module.exports = {calculInterestScore};
