# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

variable "domain" {
  description = "Production domain, e.g. getresolved.site."
  type        = string
}

variable "enable_dashboard" {
  description = "Serve the dashboard on the domain (needs amplify_app_id). A known value, so plans work before the app exists."
  type        = bool
  default     = false
}

variable "amplify_app_id" {
  description = "Amplify app serving the dashboard on the domain."
  type        = string
  default     = null
}

variable "amplify_branch" {
  description = "Amplify branch served on the domain."
  type        = string
  default     = "main"
}
