const {getUrlParts} = require('@ecadagiani/jstools');

function getDomain(url) {
    const urlParts = getUrlParts(url);
    if(!urlParts) return null;
    return urlParts.hostname;
    // return urlParts.domain;
}

function promiseFunction(func) {
    return (...args) => {
        return new Promise(async resolve => {
            const res = await func(...args);
            resolve(res);
        });
    };
}

module.exports = {
    getDomain,
    promiseFunction
};
