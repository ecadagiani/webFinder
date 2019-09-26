const {getRndInteger} = require('../lib/tools');

function calculInterestScore(url, linkTexts, pageLanguage, config){
    const {
        interestLanguage, interestTag, uninterestingTag, interestTagUrl, uninterestingTagUrl,
        interestTagImpact, uninterestingTagImpact, interestTagUrlImpact, uninterestingTagUrlImpact
    } = config;
    let score = 0;
    if( interestLanguage.includes(pageLanguage) )
        score += 10;

    const interestRegexArray = interestTag.map(tag => new RegExp(tag, 'i'));
    const uninterestRegexArray = uninterestingTag.map(tag => new RegExp(tag, 'i'));
    const interestUrlRegexArray = interestTagUrl.map(tag => new RegExp(tag, 'i'));
    const uninterestUrlRegexArray = uninterestingTagUrl.map(tag => new RegExp(tag, 'i'));

    if(interestUrlRegexArray.some(reg => reg.test(url)))
        score += interestTagUrlImpact;
    if(uninterestUrlRegexArray.some(reg => reg.test(url)))
        score += uninterestingTagUrlImpact;

    linkTexts.forEach(text => {
        if(interestRegexArray.some(reg => reg.test(text)))
            score += interestTagImpact;
        if(uninterestRegexArray.some(reg => reg.test(text)))
            score += uninterestingTagImpact;
    });

    score += getRndInteger(0, 2); // add some random

    // todo check le nombre de link fetch du même domaine, si c'est trop gros on baisse le score proportionnelement
    // le check doit etre memorisé

    return score;
}


module.exports = {calculInterestScore};
