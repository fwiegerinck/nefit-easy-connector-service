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
          reconnect_timeout: configuration.nefit.reconnect_timeout ? configuration.nefit.reconnect_timeout : 30
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

}

const config_instance = new Configuration();

module.exports = config_instance;
