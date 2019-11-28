class ManagerPlugin {
    constructor( manager ) {
        this.__manager = manager;
    }

    log( ...texts ) {
        const date = new Date();
        console.log( `[${date.toISOString()}] Manager - Plugin: `, ...texts );
    }

    onInit() {
    }

    onStart() {
    }

    /**
     * when crawler update
     * @param {Crawler} crawler
     */
    onCrawlerUpdate( crawler ) {
    }

    /**
     * when crawler start or restart
     * @param id
     * @param process
     */
    onStartCrawler( id, process ) {
    }
}

module.exports = ManagerPlugin;

/**
 * @typedef Crawler
 * @property {object} process - crawler node process
 * @property {string} id - crawler id
 * @property {string} url - crawler current url
 * @property {string} status - crawler status
 * @property {Date} lastUpdate
 */
