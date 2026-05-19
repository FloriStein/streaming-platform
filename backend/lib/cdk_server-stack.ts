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

    // HTTPS / HTTP
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

    // RTSP
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8554));

    // TURN
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3478));
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(3478));

    // TURN relay ports
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udpRange(49160, 49200));

    // =========================
    // EC2 Instance
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
    // S3 Bucket (CI/CD Source)
    // =========================
    const bucket = new s3.Bucket(this, "AppBucket", {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // EC2 hat Zugriff auf S3
    bucket.grantRead(instance.role);

    // =========================
    // SSM
    // =========================
    instance.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonSSMManagedInstanceCore",
      ),
    );

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
dnf install -y docker

systemctl enable docker
systemctl start docker

until docker info; do
  echo "waiting for docker..."
  sleep 2
done

usermod -aG docker ec2-user || true

# =========================
# Docker Compose
# =========================
curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) \
  -o /usr/local/bin/docker-compose

chmod +x /usr/local/bin/docker-compose

PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

mkdir -p /home/ec2-user/app

cat <<EOF > /home/ec2-user/app/docker-compose.yml
services:

  traefik:
    image: traefik:v3

    container_name: traefik

    restart: unless-stopped

    command:
      - "--api.insecure=true"
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"

    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"

    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

  coturn:
    image: coturn/coturn

    container_name: coturn

    restart: unless-stopped

    command: >
      -n
      --lt-cred-mech
      --fingerprint
      --realm=local
      --user=testuser:testpass
      --listening-ip=0.0.0.0
      --external-ip=$PUBLIC_IP
      --min-port=49160
      --max-port=49200

    ports:
      - "3478:3478"
      - "3478:3478/udp"
      - "49160-49200:49160-49200/udp"

  mediamtx:
    image: bluenviron/mediamtx:latest

    container_name: mediamtx

    restart: unless-stopped

    environment:
      MTX_WEBRTC: "yes"

      MTX_WEBRTCICESERVERS: |
        - urls: stun:$PUBLIC_IP:3478
        - urls: turn:$PUBLIC_IP:3478
          username: testuser
          credential: testpass

    expose:
      - "8889"

    ports:
      - "8554:8554"
      - "8189:8189/udp"

    labels:
      - "traefik.enable=true"

      - "traefik.http.routers.mediamtx.rule=PathPrefix(\`/\`)"

      - "traefik.http.routers.mediamtx.entrypoints=web"

      - "traefik.http.services.mediamtx.loadbalancer.server.port=8889"

EOF

cd /home/ec2-user/app

/usr/local/bin/docker-compose up -d
`);

    // =========================
    // Outputs
    // =========================
    new cdk.CfnOutput(this, "PublicIP", {
      value: eip.ref,
    });

    new cdk.CfnOutput(this, "TraefikDashboard", {
      value: `http://${eip.ref}:8080`,
    });
  }
}
