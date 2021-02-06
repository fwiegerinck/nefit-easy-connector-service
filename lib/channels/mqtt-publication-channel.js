'use strict';

const debug = require('debug')('nefit-easy-connector-service:MqttPublicationChannel');
const PublicationChannel = require('../publication-channel');
const MQTT = require('async-mqtt');

class MqttPublicationChannel extends PublicationChannel {

  #mqttClient = null;

  initialize(configuration) {
    super.initialize(configuration);

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
        debug("Publish as JSON to %s", this.configuration.mqtt.base_topic);
        this.#mqttClient.publish(this.configuration.mqtt.base_topic, JSON.stringify(mqttStatus));
      }

      // Each field
      if (['fields', 'both'].includes(this.configuration.mqtt.publish)) {
        debug("Publish as fields");
        let baseTopic = this.configuration.mqtt.base_topic.concat("/");
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
    let mqttClient = MQTT.connect( this.configuration.mqtt.url, mqttParameters );
    this.#mqttClient = mqttClient;

    //Update will state when required
    if (this.configuration.mqtt.last_will.topic) {
      mqttClient.publish(this.configuration.mqtt.last_will.topic, this.configuration.mqtt.last_will.payload.online);
    }

  }
}

module.exports = MqttPublicationChannel;
