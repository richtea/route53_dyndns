variable "region" {
  default = "eu-west-1"
}

provider "aws" {
  region = "${var.region}"
}

variable "lambda_log_level" {
  # Allowed values:
  # - debug
  # - info
  # - warn
  # - error
  default = "info"
}

variable "gateway_log_level" {
  # Allowed values:
  # - OFF
  # - INFO
  # - ERROR
  default = "INFO"
}

variable "gateway_data_trace_enabled" {
  default = false
}

locals {
  app_name           = "bookings"
  account_id         = "${data.aws_caller_identity.current.account_id}"
  stack_name         = "${local.app_name}_${terraform.workspace}"
  object_name_prefix = "${local.stack_name}_"
  object_name_format = "${local.object_name_prefix}%s"
  api_name           = "${format(local.object_name_format, "api")}"
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

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "LambdaBookings_role" {
  name = "${format(local.object_name_format, "LambdaBookings_role")}"
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

resource "aws_iam_role_policy_attachment" "LambdaBookings_role_AmazonDynamoDBFullAccess" {
  role       = "${aws_iam_role.LambdaBookings_role.name}"
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_role_policy_attachment" "LambdaBookings_role_CloudWatchFullAccess" {
  role       = "${aws_iam_role.LambdaBookings_role.name}"
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchFullAccess"
}

resource "aws_iam_role_policy" "ssm_read" {
  name = "ssm_read"
  role = "${aws_iam_role.LambdaBookings_role.id}"

  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
          "ssm:DescribeParameters"
      ],
      "Resource": "*"
    },
    {
        "Effect": "Allow",
        "Action": [
            "ssm:GetParameters"
        ],
        "Resource": "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${local.stack_name}/*"
    }
  ]
}
POLICY
}

variable "environment_configs" {
  type = "map"
}

module "parameters" {
  source  = "./ssm_parameter_map"
  configs = "${var.environment_configs}"
  prefix  = "${local.stack_name}"

  # kms_key_id = "${aws_kms_key.LambdaBookings_key.key_id}"
}

resource "aws_iam_policy_attachment" "cloudwatchlog" {
  name       = "cloudwatchlog"
  roles      = ["${aws_iam_role.cloudwatchlog.name}"]
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_lambda_function" "api_lambda" {
  filename         = "package/api_lambda.zip"
  function_name    = "${format(local.object_name_format, "api_lambda")}"
  role             = "${aws_iam_role.LambdaBookings_role.arn}"
  handler          = "index.handler"
  source_code_hash = "${base64sha256(file("package/api_lambda.zip"))}"
  runtime          = "nodejs6.10"
  timeout          = 15
  publish          = true

  environment {
    variables = {
      stack     = "${local.stack_name}"
      log_level = "${var.lambda_log_level}"
    }
  }
}

resource "aws_lambda_permission" "allow_api_gateway" {
  function_name = "${aws_lambda_function.api_lambda.function_name}"
  statement_id  = "AllowExecutionFromApiGateway"
  action        = "lambda:InvokeFunction"
  principal     = "apigateway.amazonaws.com"
  source_arn    = "arn:aws:execute-api:${var.region}:${data.aws_caller_identity.current.account_id}:${aws_api_gateway_rest_api.rest_api.id}/*/*/*"
}

data "template_file" "swagger_api_def" {
  template = "${file("${path.module}/api.json")}"

  vars {
    api_name   = "${local.api_name}"
    lambda_uri = "${aws_lambda_function.api_lambda.invoke_arn}"
  }
}

resource "aws_api_gateway_rest_api" "rest_api" {
  name        = "${local.api_name}"
  description = "This is my API for demonstration purposes"
  body        = "${data.template_file.swagger_api_def.rendered}"
}

resource "aws_api_gateway_deployment" "rest_api_deploy_prod" {
  rest_api_id = "${aws_api_gateway_rest_api.rest_api.id}"
  stage_name  = "prod"

  variables = {
    "stack" = "${local.stack_name}"
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
