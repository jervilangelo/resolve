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
  default     = 50
}

variable "alert_email" {
  description = "Optional address for alarm and budget notifications (requires confirmation)."
  type        = string
  default     = null
}

variable "web_origins" {
  description = "Production dashboard origins."
  type        = list(string)
}

variable "ses_sender_email" {
  description = "Optional SES sender address (requires verification)."
  type        = string
  default     = null
}

variable "enable_hosting" {
  description = "Host the dashboard on AWS Amplify. Turning it off destroys the hosted app."
  type        = bool
  default     = true
}

variable "github_access_token" {
  description = "GitHub token for Amplify (repo, admin:repo_hook); needed only when creating the app."
  type        = string
  default     = ""
  sensitive   = true
}

variable "store_extension_ids" {
  description = "Extension IDs assigned by the Chrome Web Store and Edge Add-ons (sign-in callbacks)."
  type        = list(string)
  default     = []
}

variable "domain" {
  description = "Production domain (dashboard address and email sending domain)."
  type        = string
  default     = "getresolved.site"
}

variable "use_domain" {
  description = "Serve the dashboard and send alerts from var.domain (after it is delegated and verified)."
  type        = bool
  # Switched on 2026-11-25: getresolved.site delegated; SES DKIM/MAIL FROM and Amplify verified.
  default = true
}
