# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

variable "name_prefix" {
  type = string
}

variable "deletion_protection" {
  type = bool
}

variable "web_callback_urls" {
  type = list(string)
}

variable "web_logout_urls" {
  type = list(string)
}

variable "enable_integration_test_client" {
  type    = bool
  default = false
}

variable "logo_light_svg" {
  description = "Logo shown on managed login pages in light mode."
  type        = string
}

variable "logo_dark_svg" {
  description = "Logo shown on managed login pages in dark mode."
  type        = string
}
