'use strict';

console.log("Starting Nefit Easy Connector Service");

// Load basic modules
const debug = require('debug')('nefit-easy-connector-service:loader');
const baseDebug = require('debug');

const configuration = require('./lib/configuration');
configuration.load(process.env.CONFIG ? process.env.CONFIG : './config.yaml');

debug("Use configuration: %o", configuration);

// Process configuration
if (configuration.debug) {
  baseDebug.enable(configuration.debug)
}

// Initialize NefitEasy connector
const NefitEasyConnectorClass = require('./lib/nefit-easy-connector');
let nefitEasyConnector = new NefitEasyConnectorClass(configuration);

// Initialize channels
const publicationChannels = [];
var publicationChannelModules = require('require-all')(__dirname + '/lib/channels');
debug("Found following modules:", publicationChannelModules);
for (const channelModule in publicationChannelModules) {
  const channelClass = publicationChannelModules[channelModule];

  try {
    var channel_instance = new channelClass();
    channel_instance.initialize(configuration, nefitEasyConnector);
    if(channel_instance.available) {
      publicationChannels.push(channel_instance);
    } else {
      debug("Skip channel module", channelModule, "not available for publications");
    }
  } catch (e) {
    debug("Unable to load channel from", channelModule, " due to ", e);
  }
}
if (publicationChannels.length == 0) {
  publicationChannels.push(require('./lib/publication-channel').console);
}

// Determine application to run and execute it
let applicationToRun;
var cmdlineArguments = process.argv.slice(2);
switch(cmdlineArguments[0]) {
  case 'import-history':
    applicationToRun = require('./lib/import-history-application');
    break;
  default:
    applicationToRun = require('./lib/daemon-application');
}

applicationToRun(configuration, nefitEasyConnector, publicationChannels);
