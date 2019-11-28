const ManagerPlugin = require( '../lib/ManagerPlugin' );

class PluginManagerTest extends ManagerPlugin {
    constructor( ...params ) {
        super( ...params );
        this.onInit = this.onInit.bind( this );
        this.onStart = this.onStart.bind( this );
        this.onCrawlerUpdate = this.onCrawlerUpdate.bind( this );
        this.onStartCrawler = this.onStartCrawler.bind( this );
    }

    onInit() {
    }

    onStart() {
    }

    onCrawlerUpdate( crawler ) {
    }

    onStartCrawler( id, process ) {
    }
}

module.exports = PluginManagerTest;
