'use strict';

const debug = require('debug')('nefit-easy-connector-service:InfluxDBPublicationChannel');
const PublicationChannel = require('../publication-channel');
const Influx = require('influx');

class InfluxDBPublicationChannel extends PublicationChannel {

  #influxdbClient = null;

  initialize(configuration) {
    super.initialize(configuration);
  }

  get available() {
    return (this.configuration.influxdb);
  }

  publish(data) {
    if (this.#influxdbClient == null) {
      debug("Rebuild InfluxDB client");
      this.__buildClient();
    }

    return Promise.resolve(data).then( (status) => {

      var dataPoints = [];
      if (status.current && status.current.mode && status.current.setpoint && status.current.indoorTemperature && status.current.outdoorTemperature && status.current.pressure && status.current.supplyTemperature) {
        dataPoints.push({
          measurement: 'nefit_easy_current',
          tags: { device_serial: status.serialNumber },
          fields: {
            mode: status.current.mode,
            setpoint: status.current.setpoint,
            indoor_temperature: status.current.indoorTemperature,
            outdoor_temperature: status.current.outdoorTemperature,
            pressure: status.current.pressure,
            supply_temperature: status.current.supplyTemperature
          }
        });
      } else {
        debug("Skip current measurements; data incomplete");
      }
      if (status.dailyGasUsage && status.dailyGasUsage.timestamp) {
        dataPoints.push({
          measurement: 'nefit_easy_daily_gas_usage',
          tags: { device_serial: status.serialNumber },
          fields: {
            heating: status.dailyGasUsage.heating,
            hotwater: status.dailyGasUsage.hotwater,
            average_outdoor_temperature: status.dailyGasUsage.averageOutdoorTemperature
          },
          timestamp: status.dailyGasUsage.timestamp
        });
      } else {
        debug("Skip daily gas usage measurements; data incomplete");
      }

      if (dataPoints.length > 0 ) {
        debug("Publish data to InfluxDB: %s:%s/%s", this.configuration.influxdb.host, this.configuration.influxdb.port, this.configuration.influxdb.database);
        return this.#influxdbClient.writePoints(dataPoints);
      } else {
        debug("Skip update, no data points to write");
      }
    }).catch( (error) => {
      debug('Publication failed. Clean selection. %e', error);

      this.#influxdbClient = null;
    });
  }

  importHistory(history) {
    if (this.#influxdbClient == null) {
      debug("Rebuild InfluxDB client");
      this.__buildClient();
    }

    return Promise.resolve(history).then( (history) => {

      var dataPoints = [];

      if (history.gasUsage) {
        history.gasUsage.forEach( (gasUsageRecord ) => {
          if (gasUsageRecord && gasUsageRecord.timestamp) {
            dataPoints.push({
              measurement: 'nefit_easy_daily_gas_usage',
              tags: { device_serial: history.serialNumber },
              fields: {
                heating: gasUsageRecord.heating,
                hotwater: gasUsageRecord.hotwater,
                average_outdoor_temperature: gasUsageRecord.averageOutdoorTemperature
              },
              timestamp: gasUsageRecord.timestamp
            });
          } else {
            debug("Skip historical gas usage record; data incomplete: %o", gasUsageRecord);
          }
        });
      }

      if (dataPoints.length > 0 ) {
        debug("Publish history to InfluxDB: %s:%s/%s", this.configuration.influxdb.host, this.configuration.influxdb.port, this.configuration.influxdb.database);
        return this.#influxdbClient.writePoints(dataPoints);
      } else {
        debug("Skip import history, no data points to write");
      }
    }).catch( (error) => {
      debug('Publication failed. Clean selection. %e', error);

      this.#influxdbClient = null;
    });

  }

  __buildClient() {

    this.#influxdbClient = new Influx.InfluxDB({
      host: this.configuration.influxdb.host,
      port: this.configuration.influxdb.port,
      protocol: this.configuration.influxdb.protocol,
      database: this.configuration.influxdb.database,
      username: this.configuration.influxdb.credentials.username,
      password: this.configuration.influxdb.credentials.password,
      schema: [
        {
          measurement: 'nefit_easy_current',
          fields: {
            mode: Influx.FieldType.STRING,
            setpoint: Influx.FieldType.FLOAT,
            indoor_temperature: Influx.FieldType.FLOAT,
            outdoor_temperature: Influx.FieldType.FLOAT,
            pressure: Influx.FieldType.FLOAT,
            supply_temperature: Influx.FieldType.FLOAT
          },
          tags: [
            'device_serial'
          ]
        },
        {
          measurement: 'nefit_easy_daily_gas_usage',
          fields: {
            heating: Influx.FieldType.FLOAT,
            hotwater: Influx.FieldType.FLOAT,
            average_outdoor_temperature: Influx.FieldType.FLOAT
          },
          tags: [
            'device_serial'
          ]
        }
      ]
    });
  }
}

module.exports = InfluxDBPublicationChannel;
