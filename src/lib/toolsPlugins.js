const { readdirSync } = require( 'fs' );
const { promiseFunction } = require( '../lib/tools' );


function toolsPlugins( pluginsFolderPath, ...constructorParams ) {
    const plugins = [];
    readdirSync( pluginsFolderPath ).forEach( function( file ) {
        if ( file.indexOf( 'Plugin' ) === 0 ) {
            const Plugin = require( `${pluginsFolderPath}/${file}` );
            plugins.push(
                new Plugin( ...constructorParams )
            );
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
                handleError(e);
            }
            return res;
        }
        return undefined;
    } );
}

module.exports = {
    loadPlugins: toolsPlugins, runPlugin
};
