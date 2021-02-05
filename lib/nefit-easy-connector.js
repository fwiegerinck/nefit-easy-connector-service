'use strict';

const debug = require('debug')('nefit-easy-connector-service:NefitEasyConnector');
const Promise = require("bluebird");
const NefitEasyClient = require('nefit-easy-commands');

class NefitEasyConnector {

  #nefitClient = null;
  #awaitingReconnect = false;
  #initialConnect = true;
  #configuration = null;

  constructor(configuration) {
      this.#configuration = configuration;
  }

  fetchStatus() {
    if (this.#awaitingReconnect) {
      return Promise.reject(Error("Awaiting to reconnect to Nefit"));
    }
    // Make sure client is initialized
    if (this.#nefitClient != null) {
      debug("Fetch status");
      return this.__doFetchStatus();
    } else {
      debug("Initialize client and fetch status");
      this.#awaitingReconnect = true;

      // Start promise-chain
      let p = Promise.resolve(null);

      // Delay only when required
      if (!this.#initialConnect) {
        debug("Await %d seconds before reconnecting", this.#configuration.nefit.reconnect_timeout);
        p = p.delay(this.#configuration.nefit.reconnect_timeout*1000);
      } else {
        this.#initialConnect = false;
      }

      // Do connect
      return p.then( () => {
        return this.__buildClient();
      }).then(() => {
        return this.__doFetchStatus();
      })
    }
  }

  __doFetchStatus() {

    let promises = [this.#nefitClient.status(),
                    this.#nefitClient.pressure(),
                    this.#nefitClient.supplyTemperature()];

    return Promise.all(promises).spread(async (status, pressure, supplyTemperature) => {
          let message = {
              'mode' : status['user mode'],
              'setpoint': status['temp setpoint'],
              'inhouse':  status['in house temp'],
              'outdoorTemp': status['outdoor temp'],
              'overrideSetpoint': status['temp override temp setpoint'],
              'manualSetpoint': status['temp manual setpoint'],
              'hotWaterActive': status['hot water active']? 1 :0,
              'serial' : this.#configuration.nefit.serial_number,
              'pressure': pressure.pressure,
              'supplyTemperature': supplyTemperature.temperature
          }
          return message;
        }).catch((e) => {
          // Reset client
          this.#nefitClient = null;

          // Continue rejection
          Promise.reject(e);
        });
  }

  __buildClient() {
    this.#nefitClient =  NefitEasyClient({
        serialNumber   : this.#configuration.nefit.serial_number,
        accessKey      : this.#configuration.nefit.access_key,
        password       : this.#configuration.nefit.password
    });
    this.#awaitingReconnect = false;
    return this.#nefitClient.connect();
  }

}

module.exports = NefitEasyConnector;
