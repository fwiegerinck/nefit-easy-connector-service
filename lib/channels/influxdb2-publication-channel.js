'use strict';

const debug = require('debug')('nefit-easy-connector-service:InfluxDBPublicationChannel');
const PublicationChannel = require('../publication-channel');
const {InfluxDB, Point} = require('@influxdata/influxdb-client')

class InfluxDB2PublicationChannel extends PublicationChannel {

  #influxdb2Client = null;

  initialize(configuration) {
    super.initialize(configuration);
  }

  get available() {
    return (this.configuration.influxdb2);
  }

  publish(data) {
    if (this.#influxdb2Client == null) {
      debug("Rebuild InfluxDB2 client");
      this.__buildClient();
    }

    return Promise.resolve(data).then( (status) => {

      var dataPoints = [];
      if (status.current && status.current.mode && status.current.setpoint && status.current.indoorTemperature && status.current.outdoorTemperature && status.current.pressure && status.current.supplyTemperature) {
        dataPoints.push(
          new Point('nefit_easy_current')
            .stringField('mode', status.current.mode)
            .floatField("setpoint", status.current.setpoint)
            .floatField("indoor_temperature", status.current.indoorTemperature)
            .floatField("outdoor_temperature", status.current.outdoorTemperature)
            .floatField("pressure", status.current.pressure)
            .floatField("supply_temperature", status.current.supplyTemperature)
        );
      } else {
        debug("Skip current measurements; data incomplete");
      }
      if (status.dailyGasUsage && status.dailyGasUsage.timestamp) {
        dataPoints.push(
          new Point('nefit_easy_daily_gas_usage')
            .floatField("heating", status.dailyGasUsage.heating)
            .floatField("hotwater", status.dailyGasUsage.hotwater)
            .floatField("average_outdoor_temperature", status.dailyGasUsage.averageOutdoorTemperature)
            .timestamp(status.dailyGasUsage.timestamp)
        );
      } else {
        debug("Skip daily gas usage measurements; data incomplete");
      }

      if (dataPoints.length > 0 ) {
        debug("Publish history to InfluxDB: %s/%s/%s", this.configuration.influxdb2.url, this.configuration.influxdb2.organization, this.configuration.influxdb2.bucket);

        const writeApi = this.#influxdb2Client.getWriteApi(
          this.configuration.influxdb2.organization,
          this.configuration.influxdb2.bucket,
          's'
        );
  
        writeApi.useDefaultTags({serial: status.serialNumber});  
        writeApi.writePoints(dataPoints);
        
        return writeApi.close();      } else {
        debug("Skip update, no data points to write");
      }
    }).catch( (error) => {
      debug('Publication failed. Clean selection.', error);

      this.#influxdb2Client = null;
    });
  }

  importHistory(history) {
    if (this.#influxdb2Client == null) {
      debug("Rebuild InfluxDB2 client");
      this.__buildClient();
    }

    return Promise.resolve(history).then( (history) => {

      var dataPoints = [];

      if (history.gasUsage) {
        history.gasUsage.forEach( (gasUsageRecord ) => {
          if (gasUsageRecord && gasUsageRecord.timestamp) {
            dataPoints.push(
              new Point('nefit_easy_daily_gas_usage')
                .floatField("heating", gasUsageRecord.heating)
                .floatField("hotwater", gasUsageRecord.hotwater)
                .floatField("average_outdoor_temperature", gasUsageRecord.averageOutdoorTemperature)
                .timestamp(gasUsageRecord.timestamp)
            );
          } else {
            debug("Skip historical gas usage record; data incomplete: %o", gasUsageRecord);
          }
        });
      }


      if (dataPoints.length > 0 ) {
        debug("Publish history to InfluxDB: %s/%s/%s", this.configuration.influxdb2.url, this.configuration.influxdb2.organization, this.configuration.influxdb2.bucket);

        const writeApi = this.#influxdb2Client.getWriteApi(
          this.configuration.influxdb2.organization,
          this.configuration.influxdb2.bucket,
          's',
          { batchSize : 20 } // Prevent HTTP timeout on batch import
        );
  
        writeApi.useDefaultTags({serial: history.serialNumber});  
        dataPoints.forEach( (point, i) => {
          writeApi.writePoint(point);
        })
        
        return writeApi.close();
      } else {
        debug("Skip import history, no data points to write");
      }
    }).catch( (error) => {
      debug('Publication failed. Clean selection.', error);

      this.#influxdb2Client = null;
    });

  }

  __buildClient() {

    this.#influxdb2Client = new InfluxDB({
      url: this.configuration.influxdb2.url,
      token: this.configuration.influxdb2.token
    });
    //   schema: [
    //     {
    //       measurement: 'nefit_easy_current',
    //       fields: {
    //         mode: Influx.FieldType.STRING,
    //         setpoint: Influx.FieldType.FLOAT,
    //         indoor_temperature: Influx.FieldType.FLOAT,
    //         outdoor_temperature: Influx.FieldType.FLOAT,
    //         pressure: Influx.FieldType.FLOAT,
    //         supply_temperature: Influx.FieldType.FLOAT
    //       },
    //       tags: [
    //         'device_serial'
    //       ]
    //     },
    //     {
    //       measurement: 'nefit_easy_daily_gas_usage',
    //       fields: {
    //         heating: Influx.FieldType.FLOAT,
    //         hotwater: Influx.FieldType.FLOAT,
    //         average_outdoor_temperature: Influx.FieldType.FLOAT
    //       },
    //       tags: [
    //         'device_serial'
    //       ]
    //     }
    //   ]
    // });
  }
}

module.exports = InfluxDB2PublicationChannel;
