variable "region" {
  default = "eu-west-1"
}

provider "aws" {
  region = "${var.region}"
}

variable "gateway_log_level" {
  # Allowed values:
  # - OFF
  # - INFO
  # - ERROR
  default = "INFO"
}

variable "lambda_log_debug" {
  default = "false"
}

variable "gateway_data_trace_enabled" {
  default = false
}

data "aws_caller_identity" "current" {}


locals {
  app_name              = "dyndns"
  account_id            = "${data.aws_caller_identity.current.account_id}"
  stack_name            = "${terraform.workspace}"
  stack_fullname        = "${local.app_name}_${local.stack_name}"
  object_name_prefix    = "${local.stack_fullname}_"
  object_name_format    = "${local.object_name_prefix}%s"
  api_name              = "${format(local.object_name_format, "api")}"
  api_description       = "DynDNS2 API for AWS Route53"
  lambda_zip_file       = "zip/dyndns_lambda.zip"
  lambda_function_name  = "${format(local.object_name_format, "api_lambda")}"
  ssm_param_username    = "/${local.app_name}/${local.stack_name}/username"
  ssm_param_password    = "/${local.app_name}/${local.stack_name}/password"
}

# This is global. For the second or subsequent stack in an account, you will need to run 
# > terraform import aws_api_gateway_account.gateway aws_api_gateway_account
resource "aws_api_gateway_account" "gateway" {
  cloudwatch_role_arn = "${aws_iam_role.cloudwatchlog.arn}"
}

# This is global. For the second or subsequent stack in an account, you will need to run 
# > terraform import aws_iam_role.cloudwatchlog cloudwatchlog
resource "aws_iam_role" "cloudwatchlog" {
  name = "cloudwatchlog"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "apigateway.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
}

resource "aws_iam_policy_attachment" "cloudwatchlog" {
  name       = "cloudwatchlog"
  roles      = ["${aws_iam_role.cloudwatchlog.name}"]
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_iam_role" "lambda_exec_role" {
  name = "${format(local.object_name_format, "lambda_exec_role")}"
  path = "/"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY
}

# This is the policy for the lambda execution role, which controls what actions 
# the lambda can perform
data "aws_iam_policy_document" "lambda_exec_policy_doc" {

    # Allow access to read/modify Route53
    statement {
      actions = [
        "route53:GetHostedZone",
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets",
        "route53:GetHostedZoneLimit"
      ]
      resources = [
        "arn:aws:route53:::hostedzone/*"
      ]
    }

    statement {
      actions = [
        "route53:ListHostedZones",
        "route53:GetHostedZoneCount",
        "route53:ListHostedZonesByName"
      ]
      resources = [
        "*"
      ]
    }

    # Cloudwatch access
    statement {
      actions = [
        "logs:CreateLogGroup"
      ]
      resources = [
        "arn:aws:logs:${var.region}:${local.account_id}:*"
      ]
    }

    statement {
      actions = [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      resources = [
        "arn:aws:logs:${var.region}:${local.account_id}:log-group:/aws/lambda/${aws_lambda_function.api_lambda.function_name}:*"
      ]
    }

    # SSM Parameters access
    statement {
      actions = [
        "ssm:DescribeParameters"
      ]
      resources = [
        "*"
      ]
    }

    statement {
      actions = [
        "ssm:GetParameters"
      ]
      resources = [
        "arn:aws:ssm:${var.region}:${local.account_id}:parameter/${local.app_name}/${local.stack_name}/*"
      ]
    }

    # KMS access
    statement {
      actions = [
        "kms:Decrypt"
      ]
      resources = [
        "*"
      ]
    }
}

# resource "aws_iam_role_policy_attachment" "lambda_exec_role_CloudWatchFullAccess" {
#   role       = "${aws_iam_role.lambda_exec_role.name}"
#   policy_arn = "arn:aws:iam::aws:policy/CloudWatchFullAccess"
# }

resource "aws_iam_role_policy" "lambda_exec" {
  name_prefix = "${local.stack_fullname}-"
  role        = "${aws_iam_role.lambda_exec_role.id}"
  policy      = "${data.aws_iam_policy_document.lambda_exec_policy_doc.json}"
}

resource "aws_lambda_function" "api_lambda" {
  filename         = "${local.lambda_zip_file}"
  function_name    = "${local.lambda_function_name}"
  role             = "${aws_iam_role.lambda_exec_role.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("${local.lambda_zip_file}"))}"
  runtime          = "nodejs8.10"
  timeout          = 15
  publish          = true

  environment {
    variables = {
      stack     = "${local.stack_name}"
    }
  }
}

resource "aws_lambda_permission" "allow_api_gateway" {
  function_name = "${aws_lambda_function.api_lambda.function_name}"
  statement_id  = "AllowExecutionFromApiGateway"
  action        = "lambda:InvokeFunction"
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.region}:${local.account_id}:${aws_api_gateway_rest_api.rest_api.id}/*/*/*"
}

data "template_file" "swagger_api_def" {
  template = "${file("${path.module}/../doc/api-swagger-template.yaml")}"

  vars {
    api_name   = "${local.api_name}"
    lambda_uri = "${aws_lambda_function.api_lambda.invoke_arn}"
  }
}

resource "aws_api_gateway_rest_api" "rest_api" {
  name        = "${local.api_name}"
  description = "${local.api_description}"
  body        = "${data.template_file.swagger_api_def.rendered}"
}

resource "aws_api_gateway_deployment" "rest_api_deploy_prod" {
  rest_api_id = "${aws_api_gateway_rest_api.rest_api.id}"
  stage_name  = "prod"

  variables = {
    "stack" = "${local.stack_name}"
    "log_debug" = "${var.lambda_log_debug}"
    "username_param" = "${local.ssm_param_username}"
    "password_param" = "${local.ssm_param_password}"
  }
}

output "rest_api_base_url" {
  value = "${aws_api_gateway_deployment.rest_api_deploy_prod.invoke_url}"
}

# Enable logging for all API gateway methods
resource "aws_api_gateway_method_settings" "api_gateway_settings_prod" {
  rest_api_id = "${aws_api_gateway_rest_api.rest_api.id}"
  stage_name  = "${aws_api_gateway_deployment.rest_api_deploy_prod.stage_name}"
  method_path = "*/*"

  settings {
    metrics_enabled    = true
    logging_level      = "${var.gateway_log_level}"
    data_trace_enabled = "${var.gateway_data_trace_enabled}"
  }
}

output "username_param" {
  value = "${local.ssm_param_username}"
}
output "password_param" {
  value = "${local.ssm_param_password}"
}

