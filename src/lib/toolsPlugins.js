const { readdirSync } = require( 'fs' );
const { promiseFunction } = require( '../lib/tools' );


function loadPlugins( pluginsFolderPath, constructorParams, logDebug ) {
    const plugins = [];
    readdirSync( pluginsFolderPath ).forEach( function( file ) {
        if ( file.indexOf( 'Plugin' ) === 0 ) {
            logDebug('load plugin', `${pluginsFolderPath}/${file}`);
            try {
                const Plugin = require( `${pluginsFolderPath}/${file}` );
                plugins.push(
                    new Plugin( ...constructorParams )
                );
            } catch ( err ) {
                console.error( err );
                console.error( "Above error emitted on load:", `${pluginsFolderPath}/${file}` );
            }
        }
    } );
    return plugins;
}

async function runPlugin( {
    plugins, pluginMethod, params, timeout, handleError
} ) {
    return Promise.map( plugins, async plugin => {
        if ( typeof plugin[pluginMethod] === 'function' ) {
            let res = undefined;
            try {
                res = await promiseFunction( plugin[pluginMethod] )( ...params ).timeout( timeout );
            } catch ( e ) {
                handleError( e );
            }
            return res;
        }
        return undefined;
    } );
}

module.exports = {
    loadPlugins, runPlugin
};
