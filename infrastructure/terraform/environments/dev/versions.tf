# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.73"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.8"
    }
  }

  # Partial configuration: supply bucket/key/region with `terraform init -backend-config=backend.hcl`
  # (git-ignored; see backend.hcl.example). State locking uses S3 native lock files.
  backend "s3" {
    encrypt      = true
    use_lockfile = true
  }
}
