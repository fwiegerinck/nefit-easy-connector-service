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
                    this.#nefitClient.supplyTemperature(),
                    this.#nefitClient.gasUsage()];

    return Promise.all(promises).spread(async (status, pressure, supplyTemperature, gasUsage) => {
          debug("Nefit Easy - status: %o", status);

          const lastGasUsage = gasUsage.reduce( (prev, current) => {
            return (prev.date > current.date) ? prev : current;
          })

          let message = {
              'serialNumber' : this.#configuration.nefit.serial_number,
              'current' : {
                'mode': status['user mode'], // auto or manual
                'hotWaterActive': status['hot water active'], //? 1 :0,
                'setpoint': status['temp setpoint'],
                'boilerState': status['boiler indicator'],

                'indoorTemperature': status['in house temp'],
                'outdoorTemperature': status['outdoor temp'],

                'pressure': pressure.pressure,
                'supplyTemperature' : supplyTemperature.temperature
              },
              'dailyGasUsage': {
                'heating': lastGasUsage['central heating']*this.#configuration.nefit.conversion_factor_m3,
                'hotwater': lastGasUsage['hot water']*this.#configuration.nefit.conversion_factor_m3,
                'averageOutdoorTemperature': lastGasUsage['average outdoor temperature'],
                'timestamp': new Date(lastGasUsage['date'].getTime() + (this.#configuration.nefit.timezone*3600000))
              }
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
