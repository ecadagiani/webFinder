function log( ...texts ) {
    const date = new Date();
    console.log( `[${date.toISOString()}] Crawler ${this.id}: `, ...texts );
}

function logDebug( ...texts ) {
    if ( this.config.debug )
        this.log( ...texts );
}

function logError( ...texts ) {
    const date = new Date();
    console.error( `[${date.toISOString()}] Crawler ${this.id}: `, ...texts );
}

function logTime( text ) {
    console.time(text);
}

function logTimeEnd( text ) {
    console.timeEnd(text);
}

function error( error ) {
    if ( error instanceof Error )
        throw new Error( `Crawler ${this.id}: ${error.message}` );
    throw new Error( `Crawler ${this.id}: ${error}` );
}

module.exports = {
    log, logDebug, logError, error,
    logTime,
    logTimeEnd
};
