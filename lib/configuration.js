'use strict';

const debug = require('debug')('nefit-easy-connector-service:configuration');
const fs = require('fs');
const YAML = require('YAML');
const Promise = require("bluebird");

class Configuration {

  load(localFilename) {
    let configurationObj = this._loadFromFile(localFilename);

    debug("parsed config: %o", configurationObj);

    this.__parseBaseConfig(configurationObj);
    this.__parseNefitConfig(configurationObj);
    this.__parseFileConfig(configurationObj);
    this.__parseInfluxDBConfig(configurationObj);

    fs.watch(localFilename, {persistent: false}, (eventType, filename) => {
      debug("Config file has changed, exit application to force restart");
      process.exit();
    });
  }

  _loadFromFile(localFilename) {
    debug("Configuration file: %s", localFilename);

    if (!fs.existsSync(localFilename)) {
      console.error("Missing configuration file:", localFilename);
      process.exit();
    }

    let fsConfigFile = fs.openSync(localFilename);
    try {
      let rawConfig = fs.readFileSync(fsConfigFile, 'utf8');
      debug("Configuration to be parsed: %s", "\n".concat(rawConfig));
      return YAML.parse(rawConfig);
    } finally {
      fs.closeSync(fsConfigFile);
    }
  }

  __parseBaseConfig(configuration) {
    this.debug = configuration.debug;
    this.polling_interval = configuration.polling_interval ? configuration.polling_interval : "10"
  }

  __parseNefitConfig(configuration) {
    if (configuration.nefit && configuration.nefit.access_key
      && configuration.nefit.serial_number && configuration.nefit.password) {
        this.nefit = {
          access_key: configuration.nefit.access_key,
          serial_number: configuration.nefit.serial_number,
          password: configuration.nefit.password,
          reconnect_timeout: configuration.nefit.reconnect_timeout ? configuration.nefit.reconnect_timeout : 30,
          timezone: configuration.nefit.timezone ? configuration.nefit.timezone : 1,
          conversion_factor_m3: configuration.nefit.conversion_factor_m3 ? configuration.nefit.conversion_factor_m3 : 0.102365,
        }
    } else {
      console.error("Missing or incomplete Nefit Easy configuration");
    }
  }

  __parseFileConfig(configuration) {
    if ('file' in configuration) {
      let fileConfig = configuration.file ? configuration.file : {}
      this.file = {
        path: fileConfig.path ? fileConfig.path : "/var/nefit-easy/status.log"
      }
    }
  }

  __parseInfluxDBConfig(configuration) {
    if ('influxdb' in configuration) {
      let influxdbConfig = configuration.influxdb ? configuration.influxdb : {}

      if (influxdbConfig.host && influxdbConfig.database && influxdbConfig.credentials
        && influxdbConfig.credentials.username && influxdbConfig.credentials.password ) {

        this.influxdb = {
          host: influxdbConfig.host,
          port: influxdbConfig.port ? influxdbConfig.port : 8086,
          protocol: influxdbConfig.protocol ? influxdbConfig.protocol : "https",
          database: influxdbConfig.database,
          credentials: {
            username: influxdbConfig.credentials.username,
            password: influxdbConfig.credentials.password,
          }
        }
      } else {
        console.error("Missing or incomplete Influx DB configuration");
      }
    }
  }
}

const config_instance = new Configuration();

module.exports = config_instance;
