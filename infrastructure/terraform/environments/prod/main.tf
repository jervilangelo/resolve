# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

provider "aws" {
  region              = var.aws_region
  allowed_account_ids = var.allowed_account_ids

  default_tags {
    tags = {
      Project   = "resolve"
      Stage     = "prod"
      ManagedBy = "terraform"
    }
  }
}

module "resolve" {
  source             = "../../modules/stack"
  stage              = "prod"
  web_origins        = var.web_origins
  log_retention_days = 90
  monthly_budget_usd = var.monthly_budget_usd
  # CI passes unset secrets as empty strings; treat them as "not configured".
  alert_email      = var.alert_email == "" ? null : var.alert_email
  ses_sender_email = var.ses_sender_email == "" ? null : var.ses_sender_email
  # Dashboard on Amplify Hosting. The token is needed only when the app is first created.
  enable_hosting      = var.enable_hosting
  github_access_token = var.github_access_token == "" ? null : var.github_access_token
}
