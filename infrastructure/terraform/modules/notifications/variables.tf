# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

variable "name_prefix" {
  type = string
}

variable "table_stream_arn" {
  type = string
}

variable "relay_source_dir" {
  type = string
}

variable "log_retention_days" {
  type = number
}
