# nefit-easy-connector-service

Connects Nefit Easy backend with different targets. Supported targets are:
* MQTT - publication of metrics and update of state
* InfluxDB - publish metrics to a time series database with different measurements for current and dialy usage.
* File - publish a snapshot of the metrics to a file on the filesystem.

The application is inspired by the [`nefit-easy-mqtt-bridge`](https://github.com/jgeraerts/nefit-easy-mqtt-bridge) and [`nefiteasy-influxdb`](https://github.com/TrafeX/nefiteasy-influxdb).

## Usage

* install dependencies using `npm install` or build a docker image using the provided Dockerfile
* create the configuration file `config.yaml` and update the configuration (see below)
* (optional) import history of dialy gas usage into InfluxDB or to file by running `node app.js import-history`
* run `node app.js` to start the daemon

## Configuration

The configuration is defined as a YAML file. By default the configuration is loaded from `config.yaml` in the current directory. Defining the environment variable `CONFIG` will overwrite the location of the configuration file.

The general structure of the configuration file is:
```YAML
nefit:
  serial_number: [serialnumber]
  access_key: [...]
  password: [...]

file:
  path: /var/nefit-easy/status.json

influxdb:
  host: localhost
  port: 8086
  database: home_metrics
  protocol: https
  credentials:
    username: root
    password: root

mqtt:
  url: mqtt://localhost:1883
  credentials:
    username: [...]
    password: [...]
  base_topic: nefit/[serialnumber]
  publish: both # fields | json | both
  last_will:
    topic: nefit/[serialnumber]/available
    payload:
      online: online
      offline: offline

debug: nefit-easy-core nefit-easy-connector-service:*
polling_interval: 10
```

### Generic settings

Overwrite the default generic settings using the following options:

| setting | required? | default | description |
| --------|:---------:|:-------:|-------------|
| debug   | no | _(empty)_  | enable debugging logging. set to `nefit-easy-connector-service:*` to get all debug logging for this application. |
| polling_interval | no | 10 | the interval in seconds to collect data from nefit easy. |

### Nefit easy

Configure the Nefit Easy with the following parameters in the `nefit` section:

#### Required

| setting | required? | default | description |
| --------|:---------:|:-------:|-------------|
| serial_number | yes  | _n/a_  | The serial number of your Nefit Easy |
| access_key | yes | _n/a_ | The access key associated with your Nefit Easy |
| password | yes | _n/a_ | The password of the Nefit Easy |

#### Optional

| setting | required? | default | description |
| --------|:---------:|:-------:|-------------|
| reconnect_timeout | yes  | 30  | The timeout in seconds before reconnecting when connection is lost. Prevents hammering Nefit backend causing a lockout. |
| timezone | yes | 1 | The timezone correction inhours. |
| conversion_factor_m3 | no | 0.102365 | Conversation factory used to convert from kWh to m3 gas usage. |

### Publish to file

To enable publication to file, add the `file:` section.

| setting | required? | default | description |
| --------|:---------:|:-------:|-------------|
| path | no  | /var/nefit-easy/status.log | Location of the file to publish to. Make sure the directory structure already exists |

### Publish to InfluxDB

To enable publication to InfluxDB, add the `influxdb:` section and define the required attributes.

#### Required
| setting | required? | default | description |
| --------|:---------:|:-------:|-------------|
| host | yes  | _n/a_ | IP or DNS address of the InfluxDB service |
| database | yes  | _n/a_ | Name of the database to connect to. |
| credentials | yes  | _n/a_ | Credentials to connect. |

#### Optional
| setting | required? | default | description |
| --------|:---------:|:-------:|-------------|
| port | no  | 8086 | Port of InfluxDB service. |
| protocol | no  | https | Protocol used to connect: http or https |




_Copyright (c) 2021 Frank Wiegerinck_
