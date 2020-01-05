# route53-dyndns

`route53-dyndns` is a Dynamic DNS (DDNS) updater for [Route53](https://aws.amazon.com/route53/).

It provides a [dyndns2](http://www.gosoftware.com.au/support/dyndns2_protocol.pdf)-compatible interface to enable your preferred client to update your DNS settings in Route53.

For the technically-minded - and if you're running this, you probably are! - `route53_dyndns` consists of an [Amazon API Gateway](https://aws.amazon.com/api-gateway/) API that proxies an [AWS Lambda](https://aws.amazon.com/lambda/) function that updates Route53 settings.

## Getting Started

To run `route53_dyndns` you will need to run the included [Terraform](https://www.terraform.io/) script that configures the necessary AWS resources. This is done from a [Gulp](https://gulpjs.com/) command.

The deploy script assumes that you already have an AWS account, and that you have installed the AWS Command Line and Terraform.

You may need to run the following command (see [here](https://stackoverflow.com/a/46250457/260213) for details):

```bash
export AWS_SDK_LOAD_CONFIG=1
```

Once you have set up your AWS environment as above, you can run the following commands to deploy the AWS resources for the updater service:

```bash
npm install
terraform init
gulp deploy
```

After deploying the service, you will also need to set up some values in the [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-paramstore.html). These parameters hold the username and password that secure your DDNS service. You will need these values to configure the DDNS client.

```bash
aws ssm put-parameter --name /dyndns/<stage-name>/username --type SecureString --value <my-dns-username>
aws ssm put-parameter --name /dyndns/<stage-name>/password --type SecureString --value <my-dns-password>
```

(The parameter names are output when you run `gulp deploy`).

## Stages

`route53_dyndns` supports a form of deployment stages, so that you can try it in a test environment before running in live. Each stage can have different settings, which are controlled by stage variables in the API Gateway.

To specify a deployment stage, use the `-s <stagename>` switch when calling `gulp deploy`. You will need to create a corresponding `<stagename>.tfvars` file. Two such files are included in the source (`default.tfvars` and `dev.tfvars`).

### Stage variables

| Variable | Description |
|----------|-------------|
| username_param | The name of the SSM param that holds the username used to secure the DDNS service.|
| password_param | The name of the SSM param that holds the password used to secure the DDNS service.|
| log_debug | A boolean value that indicates whether to log debug information. |
