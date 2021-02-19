'use strict';

const debug = require('debug')('nefit-easy-connector-service:MqttPublicationChannel');
const PublicationChannel = require('../publication-channel');
const MQTT = require('async-mqtt');

class MqttPublicationChannel extends PublicationChannel {

  #mqttClient = null;

  initialize(configuration, nefitEasyConnector) {
    super.initialize(configuration, nefitEasyConnector);

    // Only build when MQTT is configured
    if( this.available) {
      this.__buildClient();
    }
  }

  get available() {
    return (this.configuration.mqtt);
  }

  publish(data) {
    if (this.#mqttClient == null) {
      debug("Rebuild MQTT client");
      this.__buildClient();
    }

    return Promise.resolve(data).then( (status) => {

      // Build obj for publication
      var mqttStatus = { ...status.current};
      mqttStatus.serialNumber = status.serialNumber;

      debug("Publish status via MQTT with %s output: %s", this.configuration.mqtt.publish, mqttStatus);

      // Complete JSON
      if (['json', 'both'].includes(this.configuration.mqtt.publish)) {
        let targetTopic = this.configuration.mqtt.base_topic.concat("/state")
        debug("Publish as JSON to %s", targetTopic);
        this.#mqttClient.publish(targetTopic, JSON.stringify(mqttStatus));
      }

      // Each field
      if (['fields', 'both'].includes(this.configuration.mqtt.publish)) {
        debug("Publish as fields");
        let baseTopic = this.configuration.mqtt.base_topic.concat("/state/");
        for (const attribute in mqttStatus) {
          let topic = baseTopic.concat(attribute);
          let value = new String(mqttStatus[attribute]).toString();

          debug("Publish [%s]: %s", topic, value);

          this.#mqttClient.publish(topic, value);
        }
      }
    }).catch( (error) => {
      debug('Publication failed. Clean selection. %e', error);

      this.#mqttClient = null;
    });
  }

  end() {
    this.#mqttClient.end();
    this.#mqttClient = null;
  }

  __buildClient() {

    const mqttParameters = {};
    if (this.configuration.mqtt.credentials) {
      mqttParameters["username"] = this.configuration.mqtt.credentials.username;
      mqttParameters["password"] = this.configuration.mqtt.credentials.password;
    }
    if (this.configuration.mqtt.last_will.topic) {
      mqttParameters["will"] = {
          "topic": this.configuration.mqtt.last_will.topic,
          "payload": this.configuration.mqtt.last_will.payload.offline,
          "retain": true,
          "qos": 2
      }
    }
    mqttParameters["clientId"] = "NefitEasyConnectorService";
    let mqttClient = MQTT.connect( this.configuration.mqtt.url, mqttParameters );
    this.#mqttClient = mqttClient;

    //Update will state when required
    if (this.configuration.mqtt.last_will.topic) {
      mqttClient.publish(this.configuration.mqtt.last_will.topic, this.configuration.mqtt.last_will.payload.online);
    }

    // Subscribe when required
    if (this.configuration.mqtt.command) {
      mqttClient.subscribe(this.configuration.mqtt.base_topic.concat("/command/+"), {nl: false}).then((subStatus) => {
        subStatus.forEach( (status) => {
            debug("Subscribed to: %o", status);
        });

      });
      mqttClient.on('message', (topic, message) => {
          let command = topic.slice(this.configuration.mqtt.base_topic.concat("/command/").length);

          debug("Process update of %s with: %s", command, message);
          this.__processUpdate(command, message);
      });
      debug("Enable commands via MQTT")
    } else {
      debug("Skip interactive commands")
    }

  }

  __processUpdate(command, message) {
    switch(command) {
      case 'mode':
        let mode = message ? new String(message).toLowerCase() : null;
        if (["manual", "clock"].includes(mode)) {
          debug("Change thermostat mode to: %s", mode);
          this.nefitEasyConnector.setMode(mode);
        } else {
          debug("Skip update thermostat mode, unknown mode: %s", message);
        }
        break;
      case 'setpoint':
        let temp = Number(message);
        if (temp && temp !== NaN ) {
          debug("Change thermostat temperature to: %s", temp);
          this.nefitEasyConnector.setTemperature(temp);
        } else {
          debug("Skip update temperature, illegal value: %s", message);
        }
        break;
      default:
        debug("Unknown command, skip processing...");
    }
  }
}

module.exports = MqttPublicationChannel;
