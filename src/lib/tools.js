const {getUrlParts} = require('@ecadagiani/jstools');

function getDomain(url) {
    const urlParts = getUrlParts(url);
    if(!urlParts) return null;
    return urlParts.domain;
}

function testArrayOfString(array, value) {
    return array.some(pattern => {
        const reg = new RegExp(pattern, 'i');
        return reg.test(value);
    });
}

module.exports = {
    getDomain, testArrayOfString
};
