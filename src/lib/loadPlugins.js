const {readdirSync} = require('fs');

const pluginsFolderPath = '/app/src/plugins';

function loadPlugins(...constructorParams) {
    const plugins = [];
    readdirSync(pluginsFolderPath).forEach(function(file) {
        if(file.indexOf('Plugin') === 0) {
            const Plugin = require(`${pluginsFolderPath}/${file}`);
            plugins.push(
                new Plugin(...constructorParams)
            );
        }
    });

    return plugins;
}

module.exports = {
    loadPlugins
};
