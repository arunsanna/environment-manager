/* Copyright (c) Trainline Limited, 2016. All rights reserved. See LICENSE.txt in the project root for license information. */
'use strict';

angular.module('EnvironmentManager.environments').controller('DeployModalController',
  function ($scope, $http, $uibModal, $uibModalInstance, $q, Deployment, modal, awsService, accountMappingService, resources, cachedResources, parameters) {
    var vm = this;

    vm.environment = parameters.Environment;
    vm.accountName = '';
    vm.servicesList = [];
    vm.selectedServiceDeployInfo = '';
    vm.selectedServiceActiveSlice = 'N/A';
    vm.deploymentMethodsList = [];

    vm.deploymentSettings = {
      Environment: parameters.Environment.EnvironmentName,
      SelectedService: '',
      Mode: '',
      Version: '',
      PackagePath: '',
      Slice: 'blue',
    };

    function init() {
      resources.deployment.methods.all().then(function (deploymentMethods) {
        vm.deploymentMethodsList = deploymentMethods;
        vm.deploymentSettings.Mode = deploymentMethods[0].Value;
      });

      cachedResources.config.deploymentMaps.all().then(function (deploymentMaps) {
        var deployMapName = vm.environment.Value.DeploymentMap;
        if (deployMapName) {
          var deployMap = cachedResources.config.deploymentMaps.getByName(deployMapName, 'DeploymentMapName', deploymentMaps);
          if (deployMap) {
            var services = [];
            deployMap.Value.DeploymentTarget.forEach(function (target) {
              target.Services.forEach(function (service) {
                services.push(service.ServiceName);
              });
            });
            services = _.uniq(services);

            vm.servicesList = services.sort();
          }
        }

        // TODO: error handling. If dep map not found, or no services, display error message on dialog instead and disable form
      });

      accountMappingService.getAccountForEnvironment(parameters.Environment.EnvironmentName).then(function (accountName) {
        vm.accountName = accountName;
      });
    }

    $scope.$watch('vm.deploymentSettings.SelectedService', function (newVal, oldVal) {
      if (newVal) {

        var env = vm.deploymentSettings.Environment;

        vm.selectedServiceActiveSliceMessage = 'Loading...';
        vm.selectedServiceActiveSlices = [];
        resources.environment(env).inAWSAccount(vm.accountName).getSliceInfoForService(newVal).then(function (result) {
            var slices = result.data;
            if (slices && slices.length > 0) {
              vm.selectedServiceActiveSliceMessage = null;
              vm.selectedServiceActiveSlices = slices.map(function(slice){
                return 'Upstream: ' + slice.UpstreamName + ' Slice: ' + slice.Name + ' (' + slice.State + ')';
              });
            }
        }).catch(function(err){
            vm.selectedServiceActiveSliceMessage = (err.status === 404) ? 'None' : 'Unknown';
        });

        vm.selectedServiceDeployInfoMessage = 'Loading...';
        vm.selectedServiceDeployInfo = [];
        resources.environment(env).inAWSAccount(vm.accountName).getDeployedNodesInfoForService(newVal).then(function (result) {
            var nodes = result.data;
            if (nodes && nodes.length > 0) {
              vm.selectedServiceDeployInfoMessage = '';
              var nodeDescriptions = nodes.map(function(node){
                var slice = 'v' + node.ServiceTags.version;
                if (node.ServiceTags.slice && node.ServiceTags.slice != 'none') {
                  slice += ' (' + node.ServiceTags.slice + ')';
                }
                return slice;
              });
              vm.selectedServiceDeployInfo = _.uniqWith(nodeDescriptions, _.isEqual);
            } else {
              vm.selectedServiceDeployInfoMessage = 'Not deployed';
            }
        }).catch(function(err){
            vm.selectedServiceDeployInfoMessage = 'Unknown';
        });

      }
    });

    vm.ok = function () {

      var service = vm.deploymentSettings.SelectedService;
      var version = vm.deploymentSettings.Version;
      var env = vm.deploymentSettings.Environment;

      // TODO: Call Deploy API in dry-run mode to perform basic validation first

      var modalParameters = {
        title: 'Deploy Service',
        message: 'Are you sure you want to deploy ' + service + ' version ' + version + ' to ' + env + '?',
        action: 'Deploy',
        severity: 'Warning',
      };
      modal.confirmation(modalParameters).then(function () {
        $http({
          url: '/api/v1/deployments',
          method: 'post',
          data: {
            environment: env,
            version: version,
            service: service,
            mode: vm.deploymentSettings.Mode,
            slice: vm.deploymentSettings.Mode === 'bg' ? vm.deploymentSettings.Slice : undefined,
            packageLocation: vm.deploymentSettings.PackagePath,
          }
        }).then(function (response) {
          var data = response.data;
          $uibModal.open({
            templateUrl: '/app/operations/deployments/ops-deployment-details-modal.html',
            windowClass: 'deployment-summary',
            controller: 'DeploymentDetailsModalController',
            size: 'lg',
            resolve: {
              deployment: function () {
                return Deployment.getById(data.accountName, data.id);
              },
            },
          });
          $uibModalInstance.close();
        });
      });
    };

    vm.cancel = function () {
      $uibModalInstance.dismiss('cancel');
    };

    init();
  });
