'use strict';

class PublicationChannel {

  #configuration = null;

  get configuration() {
    if(!this.#configuration) {
      throw "Missing configuration for ".concact(this.connectorName);
    }
    return this.#configuration;
  }

  initialize(configuration) {
    this.#configuration = configuration;
  }

  get available() {
    return false;
  }

  publish(data) {
    // Do nothing for this one
  }

}

class ConsolePublicationChannel extends PublicationChannel {

  get available() {
    return true;
  }

  publish(data) {
    return Promise.resolve(data).then( (dataToSerialize) => {
      // Create JSON
      return JSON.stringify(dataToSerialize, null, 2);
    }).then( (jsonOutput) => {
      console.log("Nefit Easy status", jsonOutput);
    });
  }

}

module.exports = PublicationChannel;
module.exports.console = new ConsolePublicationChannel();
