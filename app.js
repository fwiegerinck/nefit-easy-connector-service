'use strict';

console.log("Starting Nefit Easy Connector Service");

// Load basic modules
const Promise = require("bluebird");
const debug = require('debug')('nefit-easy-connector-service:app');
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
// publicationChannelClasses.forEach( channelClass => {
  try {
    var channel_instance = new channelClass();
    channel_instance.initialize(configuration);
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

// Define cycle control paraemters
var fetchStatusFlowControl = {
  last_cycle: 0,
  active: -1
}

function fetchStatus() {
  // Update index of cycle
  let current_cycle = fetchStatusFlowControl.last_cycle++;

  if (fetchStatusFlowControl.active >= 0) {
    debug("Skip cycle(%d), previous cycle (%d) still in progress", current_cycle, fetchStatusFlowControl.active);
    return;
  }

  fetchStatusFlowControl.active = current_cycle;
  debug('Fetch status called: %d', current_cycle);

  return Promise.resolve(nefitEasyConnector.fetchStatus()).then((status) => {
    debug("Status: %o", status);

    // Publish to each channel
    let publishPromises = [];
    publicationChannels.forEach(channel => publishPromises.push(channel.publish(status)));

    return Promise.all(publishPromises).finally(() => {
      debug("Completed publication of status update");
    })
  }, (e) => {
      debug('Unable to fetch data, update failed', e)
  }).finally(() => {
      debug("Finished update flow");
      fetchStatusFlowControl.active = -1;
  });

}

// Schedule recurring update
setInterval( fetchStatus, configuration.polling_interval*1000 );
// Perform initial fetch
fetchStatus();
