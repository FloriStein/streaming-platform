#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { StreamingStack } from "../lib/cdk_server-stack";

const app = new cdk.App();

new StreamingStack(app, "StreamingStack", {
  env: {
    region: "eu-central-1",
  },
});
