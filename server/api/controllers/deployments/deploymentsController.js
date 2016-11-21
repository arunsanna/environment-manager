/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

let deploymentsHelper = require('modules/queryHandlersUtil/deployments-helper');
let GetNodeDeploymentLog = require('queryHandlers/deployments/GetNodeDeploymentLog');
let co = require('co');
let sender = require('modules/sender');
let validUrl = require('valid-url');
let Enums = require('Enums');
let Environment = require('models/Environment');

/**
 * GET /deployments
 */
function getDeployments(req, res, next) {
  const since = req.swagger.params.since.value;
  const environment = req.swagger.params.environment.value;
  const status = req.swagger.params.status.value;
  const cluster = req.swagger.params.cluster.value;

  deploymentsHelper.scan({
    since, environment, status, cluster
  }).then((data) => res.json(data)).catch(next);
}

/**
 * GET /deployments/{key}
 */
function getDeploymentById(req, res, next) {
  const key = req.swagger.params.id.value;

  return deploymentsHelper.get({ key })
    .then((data) => res.json(data)).catch(next);
}

/**
 * GET /deployments/{id}/log
 */
function getDeploymentLog(req, res, next) {
  return co(function* () {
    const key = req.swagger.params.id.value;
    const account = req.swagger.params.account.value;
    const node = req.swagger.params.instance.value;
    
    let deployment = yield deploymentsHelper.get({ key, account });
    let environment = deployment.Value.EnvironmentName;

    let query = {
      account,
      environment,
      deploymentId: key,
      node,
    };

    return GetNodeDeploymentLog(query).then(data => {
      res.send(data.replace(/\n/g,  '<br />'));
    });
  }).catch(next);
}

/**
 * POST /deployments
 */
function* postDeployment(req, res, next) {
  // These are required
  const body = req.swagger.params.body.value; 
  const environmentName = body.environment;
  const serviceName = body.service;
  const serviceVersion = body.version;
  const packagePath = body.packageLocation;

  // These are optional
  const mode = body.mode || 'overwrite';
  const serviceSlice = body.slice || 'none';
  const serverRoleName = req.serverRoleName; // This is attached in authorizer, TODO(filip): extract to new middleware

  let packageType = validUrl.isUri(packagePath) ? Enums.SourcePackageType.CodeDeployRevision : Enums.SourcePackageType.DeploymentMap;

  let environment = yield Environment.getByName(environmentName);
  let environmentType = yield environment.getEnvironmentType();
  let accountName = environmentType.AWSAccountName;

  // Check for input errors
  if (mode === 'overwrite' && serviceSlice !== undefined && serviceSlice !== 'none') {
    let error = `Slice can be set only to 'none' in overwrite mode.`;
    res.send({ error });
    res.status(400);
    return;
  }

  let command = {
    name: 'DeployService',
    accountName,
    environmentName,
    serviceName,
    serviceVersion,
    serviceSlice,
    packageType,
    packagePath,
    serverRoleName,
  };

  sender.sendCommand({ command, user: req.user }).then((deployment) => {
    res.status(201);
    res.location(`/api/v1/deployments/${deployment.id}`);
    res.json(deployment);
  }).catch(next);
}

/**
 * PATCH /deployments
 */
function patchDeployment(req, res, next) {
  const body = req.swagger.params.body.value;
  let status = body.Status;
  if (status !== 'Cancelled') {
    let error = `You can only PATCH deployment with { Status: 'Cancelled' } to cancel it.`;
    res.send({ error });
    res.status(400);
    return;
  }

  next(new Error('not implemented'));
}

module.exports = {
  getDeployments,
  getDeploymentById,
  getDeploymentLog,
  postDeployment: co.wrap(postDeployment),
  patchDeployment
};
