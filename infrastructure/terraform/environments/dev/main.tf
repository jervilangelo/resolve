# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

# No resources are defined yet. Modules for Cognito, API Gateway/Lambda, DynamoDB, SQS/SES and
# observability are added in roadmap phase 3, and nothing is applied without explicit approval.

locals {
  stage       = "dev"
  name_prefix = "resolve-${local.stage}"
}

provider "aws" {
  region              = var.aws_region
  allowed_account_ids = var.allowed_account_ids

  default_tags {
    tags = {
      Project   = "resolve"
      Stage     = local.stage
      ManagedBy = "terraform"
    }
  }
}
