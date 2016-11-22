/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

let _ = require('lodash');
let Enums = require('Enums');
let co = require('co');
let logger = require('modules/logger');
let targetStates = require('modules/service-targets');

const HEALTH_GOOD = Enums.HEALTH_STATUS.Healthy;
const HEALTH_BAD = Enums.HEALTH_STATUS.Error;
const SERVICE_ACTION = Enums.ServiceAction.NAME;
const SERVICE_INSTALL = Enums.ServiceAction.INSTALL;

/**
 * Generate service health info (with checks list and pass / fail)
 */
function getServiceChecksInfo(serviceObjects) {
  // Get all health checks for all instances of this service
  var serviceChecks = _.flatMap(serviceObjects, 'HealthChecks');
  var checksGrouped = _.groupBy(serviceChecks, 'Name');
  return _.map(checksGrouped, function (checks, checkName) {
    // If some instances checks failed for a given check, mark as failed
    // also, don't count in instance into working
    return {
      Name: checks[0].Name,
      Status: _.some(checks, { Status: 'critical' }) ? HEALTH_BAD : HEALTH_GOOD
    };
  });
}

function getServiceOverallHealth(healthChecks) {
  return {
    Status:_.some(healthChecks, { Status: HEALTH_BAD }) ? HEALTH_BAD : HEALTH_GOOD
  };
}

function getServiceAndSlice(obj) {
  return obj.Name + (obj.Slice ? '-' + obj.Slice : '');
}

function* getServicesTargetState(environmentName, runtimeServerRoleName, instances) {
  let targetServiceStates = yield targetStates.getAllServiceTargets(environmentName, runtimeServerRoleName);
  let allServiceObjects = _.flatMap(instances, instance => instance.Services);
  allServiceObjects = _.compact(allServiceObjects);

  // Find all objects representing particular service for all nodes
  let servicesGrouped = _.groupBy(allServiceObjects, (obj) => getServiceAndSlice(obj));

  return _.map(targetServiceStates, (service) => {
    // serviceObjects now has all 'Name' service descriptors in instances
    let serviceObjects = servicesGrouped[getServiceAndSlice(service)];
    _.each(serviceObjects, (obj) => {
      checkServiceProperties(obj, service, 'Version');
      checkServiceProperties(obj, service, 'DeploymentId');
    });

    let serviceInstances = _.filter(instances, instance => _.some(instance.Services, { Name: service.Name, Slice: service.Slice }));
    let healthyNodes = _.filter(serviceInstances, (instance) => instance.OverallHealth.Status === Enums.HEALTH_STATUS.Healthy);
    let instancesHealthCount = healthyNodes.length + '/' + serviceInstances.length;
    let serviceHealthChecks = getServiceChecksInfo(serviceObjects);
    let serviceAction = service.hasOwnProperty(SERVICE_ACTION) ? service[SERVICE_ACTION] : SERVICE_INSTALL;

    return {
      Name: service.Name,
      Version: service.Version,
      Slice: service.Slice,
      DeploymentId: service.DeploymentId,
      InstancesNames: _.map(serviceInstances, 'Name'),
      InstancesHealthCount: instancesHealthCount,
      OverallHealth: getServiceOverallHealth(serviceHealthChecks, serviceInstances),
      HealthChecks: serviceHealthChecks,
      [SERVICE_ACTION]: serviceAction,
    };
  });
}

function checkServiceProperties(svcA, svcB, prop) {
  if (svcA[prop] !== svcB[prop]) {
    //TODO: What behaviour/feature do we expect if a service does not match the expected target?
    logger.warn(`${svcB.Name} ${svcB.Version} ${prop} mismatch:`);
    logger.warn(` Found: ${svcA[prop]} and ${svcB[prop]}`);
  }
}

module.exports = co.wrap(getServicesTargetState);