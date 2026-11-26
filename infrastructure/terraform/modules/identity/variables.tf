# Resolve — Take every thought captive.
# Copyright © Jervil Angelo De Leon. All rights reserved.
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

variable "extension_callback_urls" {
  description = "https://<extension-id>.chromiumapp.org/ callbacks allowed for the extension client."
  type        = list(string)
  default     = []
}
