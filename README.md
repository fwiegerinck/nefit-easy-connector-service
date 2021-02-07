# nefit-easy-connector-service

Connects Nefit Easy backend with different targets. Supported targets are:
* MQTT - publication of metrics and update of state
* InfluxDB - publish metrics to a time series database with different measurements for current and dialy usage.
* File - publish a snapshot of the metrics to a file on the filesystem.

The application is inspired by the [`nefit-easy-mqtt-bridge`](https://github.com/jgeraerts/nefit-easy-mqtt-bridge) and [`nefiteasy-influxdb`](https://github.com/TrafeX/nefiteasy-influxdb).

## Usage

* install dependencies using `npm install` or build a docker image using the provided Dockerfile
* create the configuration file `config.yaml` and update the configuration (see below)
* run `node app.js`

## Configuration

The configuration is defined as a YAML file. By default the configuration is loaded from `config.yaml` from the working directory. This can be overridden with the environment variable `CONFIG` defining a relative or absolute path.

The format looks similar to this:
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

# Copyright

Copyright (c) 2021 Frank Wiegerinck
