# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

variable "name_prefix" {
  type = string
}

variable "table_stream_arn" {
  type = string
}

variable "relay_source_dir" {
  type = string
}

variable "log_retention_days" {
  type = number
}

variable "sender_email" {
  description = "Optional SES sender address; AWS emails it a verification link."
  type        = string
  default     = null
}

variable "worker_source_dir" {
  description = "Directory holding the bundled delivery worker (index.mjs)."
  type        = string
}

variable "table_name" {
  description = "Main DynamoDB table name."
  type        = string
}

variable "table_arn" {
  description = "Main DynamoDB table ARN."
  type        = string
}

variable "user_pool_id" {
  description = "Cognito user pool holding recipient email addresses."
  type        = string
}

variable "user_pool_arn" {
  description = "Cognito user pool ARN."
  type        = string
}

variable "dashboard_url" {
  description = "Dashboard origin linked from alert emails (e.g. https://app.example.com)."
  type        = string
}
