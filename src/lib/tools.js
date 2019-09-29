const {getUrlParts} = require('@ecadagiani/jstools');

function getDomain(url) {
    const urlParts = getUrlParts(url);
    if(!urlParts) return null;
    return urlParts.domain;
}

module.exports = {
    getDomain
};
