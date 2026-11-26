# Resolve — Take every thought captive.
# Copyright © Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

variable "aws_region" {
  description = "AWS region for this stage (docs/MASTER_PLAN.md §9)."
  type        = string
  default     = "ap-southeast-1"
}

variable "allowed_account_ids" {
  description = "AWS account IDs this stage may deploy to; guards against applying to the wrong account."
  type        = list(string)

  validation {
    condition     = length(var.allowed_account_ids) > 0 && alltrue([for id in var.allowed_account_ids : can(regex("^[0-9]{12}$", id))])
    error_message = "Provide at least one 12-digit AWS account ID."
  }
}

variable "monthly_budget_usd" {
  description = "Monthly cost budget for resources tagged Project=resolve."
  type        = number
  default     = 10
}

variable "alert_email" {
  description = "Optional address for alarm and budget notifications (requires confirmation)."
  type        = string
  default     = null
}

variable "ses_sender_email" {
  description = "Optional SES sender address (requires verification)."
  type        = string
  default     = null
}
