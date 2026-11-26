# Resolve — Take every thought captive.
# Copyright © Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

variable "name" {
  type = string
}

variable "source_dir" {
  description = "Directory containing the built index.mjs."
  type        = string
}

variable "environment" {
  type    = map(string)
  default = {}
}

variable "policy_json" {
  description = "Additional IAM policy statements for this function."
  type        = string
  default     = null
}

variable "memory_size" {
  type    = number
  default = 512
}

variable "timeout" {
  type    = number
  default = 10
}

variable "log_retention_days" {
  type = number
}

variable "permissions_boundary" {
  description = "Permissions boundary policy ARN for the function's role."
  type        = string
  default     = null
}
