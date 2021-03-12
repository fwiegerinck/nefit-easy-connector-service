'use strict';

const debug = require('debug')('nefit-easy-connector-service:configuration');
const fs = require('fs');
const YAML = require('yaml');
const Promise = require("bluebird");

class Configuration {

  exitOnChange = true;

  load(localFilename) {
    let configurationObj = this._loadFromFile(localFilename);

    debug("parsed config: %o", configurationObj);

    this.__parseBaseConfig(configurationObj);
    this.__parseNefitConfig(configurationObj);
    this.__parseFileConfig(configurationObj);
    this.__parseMqttConfig(configurationObj);
    this.__parseInfluxDB2Config(configurationObj);

    fs.watch(localFilename, {persistent: false}, (eventType, filename) => {
      if (this.exitOnChange) {
        debug("Config file has changed, exit application to force restart");
        process.exit();
      } else {
        debug("Ignore config file changed");
      }
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

  __parseMqttConfig(configuration) {
    if ('mqtt' in configuration) {
      let mqttConfig = configuration.mqtt ? configuration.mqtt : {}

      if (mqttConfig.url &&
        (!mqttConfig.credentials || (mqttConfig.credentials.username && mqttConfig.credentials.password)) // either no credentials or complete
       ) {

        this.mqtt = {
          url: mqttConfig.url,
          base_topic: mqttConfig.base_topic ? mqttUtil.topic.sanitize(mqttConfig.base_topic) : "nefit/"+this.nefit.serial_number,
          publish: ["json", "fields", "both"].includes(mqttConfig.publish) ? mqttConfig.publish : "both",
        }
        if (mqttConfig.credentials) {
          this.mqtt.credentials = {
            username: mqttConfig.credentials.username,
            password: mqttConfig.credentials.password,
          }
        }
        if ('last_will' in mqttConfig) {
          let lastwillConfig = mqttConfig.last_will ? mqttConfig.last_will : {}

          this.mqtt.last_will = {
            topic: lastwillConfig.topic ? lastwillConfig.topic : this.mqtt.base_topic.concat("/available"),
            payload: {
              online: lastwillConfig.payload && lastwillConfig.payload.online ? lastwillConfig.payload.online : "online",
              offline: lastwillConfig.payload && lastwillConfig.payload.offline ? lastwillConfig.payload.offline : "offline"
            }
          }
        }
        this.mqtt.command = (mqttConfig.command === undefined) ? true : mqttConfig.command == true;
      } else {
        console.error("Missing or incomplete MQTT configuration");
      }
    }
  }

  __parseInfluxDB2Config(configuration) {
    if ('influxdb2' in configuration) {
      let influxdb2Config = configuration.influxdb2 ? configuration.influxdb2 : {}

      if (influxdb2Config.url && influxdb2Config.token && influxdb2Config.organization && influxdb2Config.bucket) {
        this.influxdb2 = {
          url: influxdb2Config.url,
          token: influxdb2Config.token,
          organization: influxdb2Config.organization,
          bucket: influxdb2Config.bucket
        }
      } else {
        console.error("Missing or incomplete InfluxDB2 configuration");
      }
    }
  }
}

const mqttUtil = {}
mqttUtil.topic = {}
mqttUtil.topic.sanitize = (topicRef) => {
  if (topicRef.charAt(-1) == '/') {
    return topicRef.slice(0, -1);
  } else {
    return topicRef;
  }
}

const config_instance = new Configuration();

module.exports = config_instance;
