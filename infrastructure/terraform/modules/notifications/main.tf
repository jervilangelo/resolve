# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

# Durable outbox pipeline (docs/MASTER_PLAN.md section 7.3):
# DynamoDB stream -> outbox relay Lambda -> SQS delivery queue (+ DLQ) -> delivery worker.
# The delivery worker and SES are added with roadmap phase 8.

resource "aws_sqs_queue" "delivery_dlq" {
  name                      = "${var.name_prefix}-notification-delivery-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "delivery" {
  name                       = "${var.name_prefix}-notification-delivery"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600
  sqs_managed_sse_enabled    = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.delivery_dlq.arn
    maxReceiveCount     = 5
  })
}

# Stream records the relay could not forward after all retries.
resource "aws_sqs_queue" "relay_failures" {
  name                      = "${var.name_prefix}-outbox-relay-failures"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

data "aws_iam_policy_document" "relay" {
  statement {
    sid       = "ReadTableStream"
    actions   = ["dynamodb:DescribeStream", "dynamodb:GetRecords", "dynamodb:GetShardIterator", "dynamodb:ListStreams"]
    resources = [var.table_stream_arn]
  }
  statement {
    sid       = "SendToQueues"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.delivery.arn, aws_sqs_queue.relay_failures.arn]
  }
}

module "relay" {
  source             = "../lambda"
  name               = "${var.name_prefix}-outbox-relay"
  source_dir         = var.relay_source_dir
  policy_json        = data.aws_iam_policy_document.relay.json
  memory_size        = 256
  log_retention_days = var.log_retention_days
  environment = {
    QUEUE_URL = aws_sqs_queue.delivery.url
  }
}

resource "aws_lambda_event_source_mapping" "relay" {
  event_source_arn              = var.table_stream_arn
  function_name                 = module.relay.function_arn
  starting_position             = "TRIM_HORIZON"
  batch_size                    = 25
  maximum_retry_attempts        = 10
  maximum_record_age_in_seconds = 86400
  function_response_types       = ["ReportBatchItemFailures"]

  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT"]
        dynamodb  = { Keys = { PK = { S = [{ prefix = "OUTBOX#" }] } } }
      })
    }
  }

  destination_config {
    on_failure {
      destination_arn = aws_sqs_queue.relay_failures.arn
    }
  }
}
