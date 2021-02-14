'use strict';

console.log("Run application to import history");

// Load basic modules
const Promise = require("bluebird");
const debug = require('debug')('nefit-easy-connector-service:import-history-app');

function importHistory(configuration, nefitEasyConnector, publicationChannels) {

  configuration.exitOnChange = false;

  // Do read history
  return Promise.resolve(nefitEasyConnector.fetchHistory()).then((history) => {
    debug("History: %o", history);

    // Publish to each channel
    let publishPromises = [];
    publicationChannels.forEach(channel => publishPromises.push(channel.importHistory(history)));

    return Promise.all(publishPromises).finally(() => {
      debug("Completed import of history");

      // Close connections
      nefitEasyConnector.end();
      publicationChannels.forEach(channel => channel.end());
    });
  }, (e) => {
      debug('Unable to import history, update failed', e)
  }).finally(() => {
      debug("Finished import of history");
  });


}

module.exports = importHistory;
