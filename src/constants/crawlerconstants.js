const basicNavigationErrorCode = {
    ERR_CERT_COMMON_NAME_INVALID: 'ERR_CERT_COMMON_NAME_INVALID',
    ERR_NAME_NOT_RESOLVED: 'ERR_NAME_NOT_RESOLVED',
    ERR_NAME_RESOLUTION_FAILED: 'ERR_NAME_RESOLUTION_FAILED',
    ERR_CONNECTION_REFUSED: 'ERR_CONNECTION_REFUSED',
    ERR_TOO_MANY_REDIRECTS: 'ERR_TOO_MANY_REDIRECTS',
    ERR_ABORTED: 'ERR_ABORTED',
    ECONNREFUSED: 'ECONNREFUSED',
};

const crawlerStatusType = {
    initial: 'initial',
    initialising: 'initialising',
    initialised: 'initialised',
    running: 'running',
    stopping: 'stopping',
    stopped: 'stopped',
};

const searchEngineDomain = 'duckduckgo.com';
const searchEngineUrl = 'https://duckduckgo.com/lite?q=${query}&s=${offset}&dc=${offset}&kl=${language}';

const crawlerPluginsFolderPath = '/app/src/plugins';
const managerPluginsFolderPath = '/app/src/managerPlugins';

module.exports = {
    basicNavigationErrorCode,
    searchEngineDomain,
    searchEngineUrl,
    crawlerStatusType,
    crawlerPluginsFolderPath,
    managerPluginsFolderPath
};
