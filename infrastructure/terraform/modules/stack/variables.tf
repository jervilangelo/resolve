# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
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
