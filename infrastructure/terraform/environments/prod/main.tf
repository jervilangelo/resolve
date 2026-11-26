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

# Route 53 DNSSEC keys and query-log groups must be in us-east-1.
provider "aws" {
  alias               = "us_east_1"
  region              = "us-east-1"
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
  alert_email = var.alert_email == "" ? null : var.alert_email
  # Alerts come from the production domain (authenticated with SPF, DKIM and DMARC).
  # Switched on once the domain's DNS is delegated and SES has verified it (use_domain = true).
  ses_sender_email = var.use_domain ? "no-reply@${var.domain}" : (var.ses_sender_email == "" ? null : var.ses_sender_email)
  custom_domain    = var.use_domain ? var.domain : null
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

# The production domain (registered at Namecheap; its nameservers point to this zone).
module "domain" {
  source = "../../modules/domain"
  domain = var.domain
  # Registered as soon as hosting exists; Amplify verifies it once DNS is delegated.
  providers        = { aws = aws, aws.us_east_1 = aws.us_east_1 }
  enable_dashboard = var.enable_hosting
  amplify_app_id   = module.resolve.amplify_app_id
}
