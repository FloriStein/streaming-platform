import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";

export class StreamingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =========================
    // VPC
    // =========================
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
    });

    // =========================
    // Security Group
    // =========================
    const sg = new ec2.SecurityGroup(this, "StreamingSG", {
      vpc,
      allowAllOutbound: true,
    });

    // HTTP / HTTPS
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

    // RTSP
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8554));

    // TURN
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3478));
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(3478));

    // TURN relay ports
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udpRange(49160, 49200));

    // WebRTC
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(8189));

    // =========================
    // S3 Bucket
    // =========================
    const bucket = new s3.Bucket(this, "AppBucket", {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // =========================
    // EC2
    // =========================
    const instance = new ec2.Instance(this, "StreamingInstance", {
      vpc,

      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),

      machineImage: ec2.MachineImage.latestAmazonLinux2023(),

      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },

      securityGroup: sg,
    });

    // =========================
    // IAM
    // =========================
    instance.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonSSMManagedInstanceCore",
      ),
    );

    bucket.grantRead(instance.role);

    // =========================
    // Elastic IP
    // =========================
    const eip = new ec2.CfnEIP(this, "ElasticIP");

    new ec2.CfnEIPAssociation(this, "EIPAssoc", {
      eip: eip.ref,
      instanceId: instance.instanceId,
    });

    // =========================
    // UserData
    // =========================
    instance.addUserData(`
#!/bin/bash
set -euxo pipefail

dnf update -y

dnf install -y docker git

systemctl enable docker
systemctl start docker

usermod -aG docker ec2-user || true

mkdir -p /home/ec2-user/app

# Docker Compose installieren
curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/bin/docker-compose

chmod +x /usr/local/bin/docker-compose
`);

    // =========================
    // Outputs
    // =========================
    new cdk.CfnOutput(this, "PublicIP", {
      value: eip.ref,
    });

    new cdk.CfnOutput(this, "BucketName", {
      value: bucket.bucketName,
    });

    new cdk.CfnOutput(this, "InstanceId", {
      value: instance.instanceId,
    });
  }
}
