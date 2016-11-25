---
title: AWS Setup Guide
layout: docs
weight: 15
sub-folder: /docs/setup/
---

<img src="/environment-manager/assets/images/not-simple.png" style="float:right; padding-left: 2em" />

Unfortunately, installing EM isn’t yet an easy process. It interacts with a lot of other technologies that need to be setup and connected correctly for end-to-end processes such as deployment to work. You will need some patience and a good level of technical skill – especially with AWS. Future releases will aim to improve and automate more of this setup process.

This installation guide presents an opinionated tutorial on what we believe is the best way to configure EM. There are many other ways this can be done, some of which are noted in the guide. All tutorials assume you are configuring the tool as suggested.

If you have not already done so, it is recommended that you read the [Concepts](/environment-manager/docs/concepts) section first.

### Overview

Installing Environment Manager requires setup and configuration of the following:

-	AWS
    - Master AWS Account
    - Child AWS Account(s)
-	Consul
-	LDAP
-	Environment Manager application
-	Machine images ( [AMIs](/environment-manager/docs/concepts#amis) )
-	Configuration Management tooling
-	Optional, if you want EM to manage load balancer rules:
    - NGINX
    - Upstreamr (a dynamic config loader for NGINX)

Each of these areas are explained in this guide.

[Next (AWS Setup) >](/environment-manager/docs/setup/aws-setup)