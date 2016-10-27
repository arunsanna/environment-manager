/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

const _ = require('lodash');
const config = require('config');
const sender = require('modules/sender');

const masterAccountName = config.getUserValue('masterAccountName');

class Service {

  constructor(data) {
    _.assign(this, data);
  }

  static getByName(name) {
    let query = {
      name: 'ScanDynamoResources',
      resource: 'config/services',
      accountName: masterAccountName,
      filter: { ServiceName: name },
    };
    return sender.sendQuery({ query }).then(obj => new Service(obj));
  }
}

module.exports = Service;
