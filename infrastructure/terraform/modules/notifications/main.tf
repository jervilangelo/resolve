# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

# Durable outbox pipeline (docs/MASTER_PLAN.md section 7.3):
# DynamoDB stream -> outbox relay Lambda -> SQS delivery queue (+ DLQ) -> delivery worker.

resource "aws_sqs_queue" "delivery_dlq" {
  name                      = "${var.name_prefix}-notification-delivery-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "delivery" {
  name = "${var.name_prefix}-notification-delivery"
  # At least six times the worker timeout, as AWS recommends for Lambda event sources.
  visibility_timeout_seconds = 720
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
  source               = "../lambda"
  permissions_boundary = var.permissions_boundary
  name                 = "${var.name_prefix}-outbox-relay"
  source_dir           = var.relay_source_dir
  policy_json          = data.aws_iam_policy_document.relay.json
  memory_size          = 256
  log_retention_days   = var.log_retention_days
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

# Sender identity for notification emails. A single verified address keeps SES in sandbox mode
# (it can only send to verified recipients) until production access and a domain are approved.
resource "aws_sesv2_email_identity" "sender" {
  count          = var.sender_email == null || !var.create_sender_identity ? 0 : 1
  email_identity = var.sender_email
}

# ---- Delivery worker (roadmap phase 8): SQS -> re-check consent -> SES -------------------------
# Created only when a verified sender exists. Without it, alerts wait in the delivery queue and the
# oldest-message-age alarm (observability) fires; nothing is lost silently.

locals {
  worker_enabled = var.sender_email != null
}

data "aws_iam_policy_document" "worker" {
  statement {
    sid       = "ReadOutboxAndGroupItems"
    actions   = ["dynamodb:GetItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["OUTBOX#*", "GROUP#*"]
    }
  }
  statement {
    sid       = "TrackDeliveries"
    actions   = ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["DELIVERY#*"]
    }
  }
  statement {
    # Only the per-recipient alert counters: no other user data can be read or changed.
    sid       = "CountRecipientAlerts"
    actions   = ["dynamodb:UpdateItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["USER#*"]
    }
    condition {
      test     = "ForAllValues:StringEquals"
      variable = "dynamodb:Attributes"
      values   = ["PK", "SK", "submissions", "ttl"]
    }
  }
  statement {
    sid       = "LookUpRecipientAddress"
    actions   = ["cognito-idp:ListUsers"]
    resources = [var.user_pool_arn]
  }
  statement {
    sid       = "SendFromTheVerifiedSender"
    actions   = ["ses:SendEmail"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "ses:FromAddress"
      values   = [coalesce(var.sender_email, "unset@invalid")]
    }
  }
  statement {
    sid       = "ConsumeDeliveryQueue"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [aws_sqs_queue.delivery.arn]
  }
}

module "worker" {
  count                = local.worker_enabled ? 1 : 0
  source               = "../lambda"
  permissions_boundary = var.permissions_boundary
  name                 = "${var.name_prefix}-notification-worker"
  source_dir           = var.worker_source_dir
  policy_json          = data.aws_iam_policy_document.worker.json
  memory_size          = 256
  timeout              = 120
  log_retention_days   = var.log_retention_days
  environment = {
    TABLE_NAME    = var.table_name
    USER_POOL_ID  = var.user_pool_id
    SENDER_EMAIL  = coalesce(var.sender_email, "unset@invalid")
    SENDER_NAME   = var.sender_name
    DASHBOARD_URL = var.dashboard_url
  }
}

resource "aws_lambda_event_source_mapping" "worker" {
  count            = local.worker_enabled ? 1 : 0
  event_source_arn = aws_sqs_queue.delivery.arn
  function_name    = module.worker[0].function_arn
  # One outbox item per invocation: a large group's fan-out gets the whole time budget.
  batch_size              = 1
  function_response_types = ["ReportBatchItemFailures"]
  scaling_config {
    # A small, steady sender: protects SES sending limits and keeps per-recipient caps exact.
    maximum_concurrency = 2
  }
}
