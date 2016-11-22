/**
 * Created by duncanh on 27/10/16.
 */
'use strict';

const AWS_REGION = 'eu-west-1';
const AWS_PROFILE = 'saml';
const CACHE_ID = 'infra-em';
const AWS = require('aws-sdk');
const Redis = require('ioredis');

const credentials = new AWS.SharedIniFileCredentials({ profile:AWS_PROFILE });
AWS.config.region = AWS_REGION;
AWS.config.credentials = credentials;

const asg = new AWS.AutoScaling();
const cache = new AWS.ElastiCache();

function describeASGs(list, NextToken) {
  return asg.describeAutoScalingGroups({ NextToken }).promise().then(data => {
    list = list.concat(data.AutoScalingGroups);
    if (data.NextToken) {
      return describeASGs(list, data.NextToken)
    } else {
      return list;
    }
  });
}

function getCacheNodeInfo() {
  return cache.describeCacheClusters({ CacheClusterId:CACHE_ID, ShowCacheNodeInfo:true }).promise()
    .then(data => data.CacheClusters[0].CacheNodes[0].Endpoint);
}

function getASGinfo() {
  describeASGs([], null).then(data => {
    let numASGs = data.length;
    let asgData = JSON.stringify(data);
    let stringBytes = asgData.length * 2;
    let sizeMb = (stringBytes / 1048576);
    let sizePerAsg = (stringBytes / numASGs) / 1024;
    console.log(`Data for ${numASGs} ASGs is ${sizeMb.toFixed(2)}Mb`);
    console.log(`Approximately ${sizePerAsg.toFixed(2)}kb per ASG`);
  });
}

function connectRedis() {
  getCacheNodeInfo().then(cacheNode => {
    console.log(`Connecting to Redis Node: ${cacheNode.Address}...`);

    const client = new Redis(cacheNode.Port, cacheNode.Address);
    client.on('error', (e) => console.error(e));
    client.on('end', (e) => console.log(`End ${e}`));
    client.on('ready', (e) => readCache(client));
  })
}

function writeCache(client) {
  const pipeline = client.pipeline();
  console.time('describe_asgs');

  return describeASGs([], null)
    .then(data => { console.timeEnd('describe_asgs'); return data; })
    .then(data => data.map(asg => JSON.stringify(asg)))
    .then(data => { console.time('redis_sadd'); return data })
    .then(data => data.forEach(i => pipeline.sadd('asgs', i)))
    .then(_ => pipeline.exec())
    .then(result => console.log('RESULT: '))
    .then(_ => console.timeEnd('redis_sadd'))
}

function readCache(client) {
  console.time('get_cache');

  client.smembers('asgs').then(result => {
    console.timeEnd('get_cache');
    console.log('Got result: ' + result.length);
  });
}


//getASGinfo();
connectRedis();
