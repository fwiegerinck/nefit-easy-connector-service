'use strict';

const debug = require('debug')('nefit-easy-connector-service:FilePublicationChannel');
const PublicationChannel = require('../publication-channel');
const fs = require('fs');

class FilePublicationChannel extends PublicationChannel {

  get available() {
    return (this.configuration.file.path);
  }

  publish(data) {
    debug("Publish data to file: %s", this.configuration.file.path);

    return Promise.resolve(data).then( (dataToSerialize) => {
      // Create JSON
      return JSON.stringify(dataToSerialize, null, 2);
    }).then( (jsonOutput) => {
      // Output
      return fs.promises.writeFile(this.configuration.file.path, jsonOutput);
    });
  }

}

module.exports = FilePublicationChannel;
