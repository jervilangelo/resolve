# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

variable "stage" {
  type = string
}

variable "github_subject_prefix" {
  description = <<-EOT
    OIDC subject prefix of the repository allowed to deploy. This repository uses GitHub immutable
    subjects (owner@id/repo@id), which survive renames; see
    GET /repos/{owner}/{repo}/actions/oidc/customization/sub.
  EOT
  type        = string
}

variable "create_oidc_provider" {
  description = "Create GitHub's OIDC identity provider in this account (once per account)."
  type        = bool
  default     = false
}
