# Resolve — Take every thought captive.
# Copyright © Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

variable "name_prefix" {
  type = string
}

variable "api_id" {
  type = string
}

variable "lambda_function_names" {
  type = list(string)
}

variable "stuck_queue_names" {
  description = "Work queues whose oldest message should never be older than an hour."
  type        = list(string)
  default     = []
}

variable "alarm_queue_names" {
  description = "Queues that should always be empty (dead-letter and failure queues)."
  type        = list(string)
}

variable "monthly_budget_usd" {
  type = number
}

variable "alert_email" {
  description = "Optional address subscribed to alerts; AWS sends a confirmation email."
  type        = string
  default     = null
}
