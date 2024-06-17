const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const Server = require('./modules/Server');

const argv = yargs(hideBin(process.argv))
    .option('config', {
        alias: 'c',
        type: 'string',
        description: 'Path to config file',
        demandOption: true,
    })
    .help()
    .argv;

const server = new Server(argv.config, false);
server.start();