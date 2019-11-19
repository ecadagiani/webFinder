const basicNavigationErrorCode = {
    ERR_CERT_COMMON_NAME_INVALID: 'ERR_CERT_COMMON_NAME_INVALID',
    ERR_NAME_NOT_RESOLVED: 'ERR_NAME_NOT_RESOLVED',
    ERR_NAME_RESOLUTION_FAILED: 'ERR_NAME_RESOLUTION_FAILED',
    ERR_ABORTED: 'ERR_ABORTED',
    ECONNREFUSED: 'ECONNREFUSED',
};

const searchEngineDomain = 'duckduckgo.com';
const searchEngineUrl = "https://duckduckgo.com/lite?q=${query}&s=${offset}&dc=${offset}";

module.exports = { basicNavigationErrorCode, searchEngineDomain, searchEngineUrl };
