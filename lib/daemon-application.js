'use strict';

console.log("Run application as a daemon");

// Load basic modules
const Promise = require("bluebird");
const debug = require('debug')('nefit-easy-connector-service:daemon-app');

var nefitEasyConnector = null;
var publicationChannels = [];

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

function runDaemon(configuration, aNefitEasyConnector, thePublicationChannels) {

  // Save connector and channels
  nefitEasyConnector = aNefitEasyConnector;
  publicationChannels = thePublicationChannels;

  // Schedule recurring update
  setInterval( fetchStatus, configuration.polling_interval*1000 );
  // Perform initial fetch
  fetchStatus();
}

module.exports = runDaemon;
