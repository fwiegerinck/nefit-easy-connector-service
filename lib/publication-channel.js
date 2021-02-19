'use strict';

class PublicationChannel {

  #configuration = null;
  #nefitEasyConnector = null;

  get configuration() {
    if(!this.#configuration) {
      throw "Missing configuration for ".concact(this.connectorName);
    }
    return this.#configuration;
  }

  get nefitEasyConnector() {
    return this.#nefitEasyConnector;
  }

  initialize(configuration, nefitEasyConnector) {
    this.#configuration = configuration;
    this.#nefitEasyConnector = nefitEasyConnector;
  }

  get available() {
    return false;
  }

  publish(data) {
    // Do nothing for this one
  }

  importHistory(history) {
    // Do nothing
  }

  end() {

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
