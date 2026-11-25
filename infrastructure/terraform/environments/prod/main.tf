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
  source               = "../../modules/stack"
  permissions_boundary = module.github_deploy.boundary_arn
  stage                = "prod"
  web_origins          = var.web_origins
  log_retention_days   = 90
  monthly_budget_usd   = var.monthly_budget_usd
  # CI passes unset secrets as empty strings; treat them as "not configured".
  alert_email      = var.alert_email == "" ? null : var.alert_email
  ses_sender_email = var.ses_sender_email == "" ? null : var.ses_sender_email
  # Dashboard on Amplify Hosting. The token is needed only when the app is first created.
  enable_hosting = var.enable_hosting
  # The beta build (fixed key, apps/extension/beta-key.pub.txt) plus store-assigned IDs.
  extension_ids = concat(
    [trimspace(file("${path.root}/../../../../apps/extension/beta-extension-id.txt"))],
    var.store_extension_ids,
  )
  github_access_token = var.github_access_token == "" ? null : var.github_access_token
}

# Keyless deploys from the repository's "prod" GitHub environment. This new account has no GitHub
# OIDC provider yet, so it is created here.
module "github_deploy" {
  source                = "../../modules/github-deploy"
  stage                 = "prod"
  github_subject_prefix = "repo:jervilangelo@324701164/resolve@1468318662"
  create_oidc_provider  = true
}
