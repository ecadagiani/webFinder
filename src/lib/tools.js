function getHostName(url) {
    let match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
    if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
        return match[2];
    }
    else {
        return null;
    }
}

function getDomain(url) {
    let hostName = getHostName(url);
    let domain = hostName;

    if (hostName != null) {
        let parts = hostName.split('.').reverse();

        if (parts != null && parts.length > 1) {
            domain = `${parts[1]  }.${  parts[0]}`;

            if (hostName.toLowerCase().indexOf('.co.uk') != -1 && parts.length > 2) {
                domain = `${parts[2]  }.${  domain}`;
            }
        }
    }

    return domain;
}

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
}

function calculInterestScore(url, linkTexts, pageLanguage, {interestLanguage, interestTag, uninterestingTag, interestTagUrl, uninterestingTagUrl}){
    let score = 0;
    if( interestLanguage.includes(pageLanguage) )
        score += 10;

    const interestRegexArray = interestTag.map(tag => new RegExp(tag, 'i'));
    const uninterestRegexArray = uninterestingTag.map(tag => new RegExp(tag, 'i'));
    const interestUrlRegexArray = interestTagUrl.map(tag => new RegExp(tag, 'i'));
    const uninterestUrlRegexArray = uninterestingTagUrl.map(tag => new RegExp(tag, 'i'));

    if(interestUrlRegexArray.some(reg => reg.test(url)))
        score += 2;
    if(uninterestUrlRegexArray.some(reg => reg.test(url)))
        score -= 2;

    linkTexts.forEach(text => {
        if(interestRegexArray.some(reg => reg.test(text)))
            score += 1;
        if(uninterestRegexArray.some(reg => reg.test(text)))
            score -= 1;
    });

    score += getRndInteger(0, 2); // add some random

    // todo check le nombre de link fetch du même domaine, si c'est trop gros on baisse le score proportionnelement
    // le check doit etre memorisé

    return score;
}


module.exports = {
    getDomain, getHostName, calculInterestScore
};
