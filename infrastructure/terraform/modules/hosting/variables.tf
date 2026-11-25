# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

variable "name_prefix" {
  description = "Resource name prefix, e.g. resolve-prod."
  type        = string
}

variable "repository" {
  description = "HTTPS URL of the GitHub repository Amplify builds from."
  type        = string
}

variable "github_access_token" {
  description = "GitHub token Amplify uses to connect to the repository (repo, admin:repo_hook)."
  type        = string
  sensitive   = true
}

variable "branch" {
  description = "Branch deployed to production."
  type        = string
  default     = "main"
}

variable "api_url" {
  description = "Resolve API endpoint."
  type        = string
}

variable "cognito_domain" {
  description = "Cognito managed login domain (https://…)."
  type        = string
}

variable "web_client_id" {
  description = "Cognito app client of the dashboard."
  type        = string
}

variable "contact_email" {
  description = "Privacy and support contact shown on the public pages."
  type        = string
  default     = null
}
