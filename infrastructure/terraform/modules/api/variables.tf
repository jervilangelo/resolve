# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

variable "name_prefix" {
  type = string
}

variable "stage" {
  type = string
}

variable "source_dir" {
  type = string
}

variable "table_name" {
  type = string
}

variable "table_arn" {
  type = string
}

variable "issuer" {
  type = string
}

variable "client_ids" {
  description = "Cognito app clients whose access tokens are accepted."
  type        = list(string)
}

variable "rules_client_ids" {
  description = "Cognito app clients allowed to fetch extension enforcement rules."
  type        = list(string)
}

variable "cors_allow_origins" {
  type = list(string)
}

variable "throttle_burst" {
  type    = number
  default = 50
}

variable "throttle_rate" {
  type    = number
  default = 25
}

variable "log_retention_days" {
  type = number
}

variable "user_pool_id" {
  description = "Cognito user pool (self-service account deletion)."
  type        = string
}

variable "user_pool_arn" {
  description = "Cognito user pool ARN (self-service account deletion)."
  type        = string
}

variable "permissions_boundary" {
  description = "Permissions boundary for the function's role."
  type        = string
  default     = null
}
