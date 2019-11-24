global.Promise = require( 'bluebird' );

const Manager = require( './Manager' );


async function startManager() {
    const manager = new Manager();
    await manager.init();
    manager.start();
}

startManager();
