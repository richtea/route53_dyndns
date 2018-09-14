# route53-dyndns

Integration that provides a [dyndns2](http://www.gosoftware.com.au/support/dyndns2_protocol.pdf)-compatible interface to update your DNS settings in [Route53](https://aws.amazon.com/route53/).

## Getting Started

Configure the CloudFormation script.

export AWS_SDK_LOAD_CONFIG=1

aws ssm put-parameter --name dyndns-username --value dnsuser --type SecureString

Stage variables

- UsernameParm
- PasswordParm
- LogDebug
