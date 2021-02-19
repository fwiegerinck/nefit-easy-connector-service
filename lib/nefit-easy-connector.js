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
    return this.__exec(() => this.__doFetchStatus());
  }

  fetchHistory() {
    return this.__exec(() => this.__doFetchHistory());
  }

  setMode(mode) {
    return this.__exec(() => {
      debug("Update Nefit Easy mode to: %s", mode);
      return this.#nefitClient.setUserMode(mode).then((value) => {
        debug("Updated completed: %s", value)
      });
    });
  }

  setTemperature(temperature) {
    return this.__exec(() => {
      debug("Update Nefit Easy temperature to: %s", temperature);
      return this.#nefitClient.setTemperature(temperature).then((value) => {
        debug("Updated completed: %s", value)
      });
    });
  }

  end() {
    this.#nefitClient.end();
    this.#nefitClient = null;
  }

  __exec(f) {
    if (this.#awaitingReconnect) {
      return Promise.reject(Error("Awaiting to reconnect to Nefit"));
    }
    // Make sure client is initialized
    if (this.#nefitClient != null) {
      debug("Execution function with valid Nefit Easy client");
      return f();
    } else {
      debug("Initialize client and execute function");
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
        return f();
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

  __doFetchHistory() {

    return this.#nefitClient.gasUsagePage().then((maxPage) => {

      debug("Maximum page", maxPage);

      let fetchUsagePromises = [];
      for(var index = 1; index <= maxPage; index++ ) {
        fetchUsagePromises.push(this.#nefitClient.gasUsage(index));
      }
      debug("Usage queries: #%d", fetchUsagePromises.length);

      return Promise.all(fetchUsagePromises).then( (gasUsagePages) => {
        debug("Fetched %d usage pages", gasUsagePages.length);
        var gasUsageRecords = [];

        gasUsagePages.forEach((gasUsagePage) => {
          gasUsagePage.forEach((gasUsageRecord) => {
            debug("Add usage record: %s", gasUsageRecord);
            gasUsageRecords.push({
              'heating': gasUsageRecord['central heating']*this.#configuration.nefit.conversion_factor_m3,
              'hotwater': gasUsageRecord['hot water']*this.#configuration.nefit.conversion_factor_m3,
              'averageOutdoorTemperature': gasUsageRecord['average outdoor temperature'],
              'timestamp': new Date(gasUsageRecord['date'].getTime() + (this.#configuration.nefit.timezone*3600000))
            });
          });
        });

        debug("Collected records: %o", gasUsageRecords);
        let records = {
            'serialNumber' : this.#configuration.nefit.serial_number,
            'gasUsage': gasUsageRecords
        };
        debug("History record: %o", records);
        return records;
      });
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
