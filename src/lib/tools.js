const {get} = require('lodash');
const {URL} = require('url');

function getUrlParts(url) {
    let parsedUrl;
    try{
        parsedUrl = new URL(url);
    }catch(err) {
        return null;
    }

    const domainResReg = (/[\w-]+\.(\w+|(co|com)\.\w+)$/gm).exec(parsedUrl.hostname);
    const extensionRegRes = (/\.(\w+$)/gm).exec(parsedUrl.pathname);
    const uriSchemeRegRes = (/[\w-]+/gm).exec(parsedUrl.protocol);

    return {
        uriScheme: get(uriSchemeRegRes, '[0]'),
        extension: get(extensionRegRes, '[1]'),
        domain: get(domainResReg, '[0]'),
        pathname: parsedUrl.pathname,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
    };
}

function getDomain(url) {
    const urlParts = getUrlParts(url);
    if(!urlParts) return null;
    return urlParts.domain;
}

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
}

function testArrayOfString(array, value) {
    return array.some(pattern => {
        const reg = new RegExp(pattern, 'i');
        return reg.test(value);
    });
}

function wait(ms) {
    return new Promise(r=>setTimeout(r, ms));
}

module.exports = {
    getDomain, getUrlParts, getRndInteger, testArrayOfString, wait
};
