# Resolve — Take every thought captive.
# Copyright © Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

variable "stage" {
  type = string
  validation {
    condition     = contains(["dev", "prod"], var.stage)
    error_message = "stage must be dev or prod."
  }
}

variable "web_origins" {
  description = "Dashboard origins allowed for CORS and Cognito redirects."
  type        = list(string)
}

variable "log_retention_days" {
  type = number
}

variable "monthly_budget_usd" {
  type = number
}

variable "alert_email" {
  type    = string
  default = null
}

variable "ses_sender_email" {
  type    = string
  default = null
}

variable "extension_ids" {
  description = "Browser extension IDs allowed to sign in (unpacked dev key or store IDs)."
  type        = list(string)
  default     = []
}

variable "enable_hosting" {
  description = "Host the dashboard on AWS Amplify (needs github_access_token)."
  type        = bool
  default     = false
}

variable "repository" {
  description = "GitHub repository Amplify builds the dashboard from."
  type        = string
  default     = "https://github.com/jervilangelo/resolve"
}

variable "github_access_token" {
  description = "GitHub token for Amplify's repository connection (only when enable_hosting)."
  type        = string
  default     = null
  sensitive   = true
}

variable "permissions_boundary" {
  description = "Permissions boundary for every role the stack creates."
  type        = string
  default     = null
}

variable "custom_domain" {
  description = "Custom domain for the dashboard (prod)."
  type        = string
  default     = null
}

variable "ses_sender_name" {
  description = "Display name on alert emails."
  type        = string
  default     = "Resolve"
  nullable    = false
  validation {
    # Must match the worker's check (SENDER_NAME in delivery-worker.ts).
    condition     = can(regex("^[A-Za-z0-9_ .-]{1,40}$", var.ses_sender_name))
    error_message = "Use 1-40 letters, digits, spaces, dots, dashes or underscores."
  }
}
