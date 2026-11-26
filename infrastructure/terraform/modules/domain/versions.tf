# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      # Route 53 DNSSEC keys and query-log groups must live in us-east-1.
      configuration_aliases = [aws.us_east_1]
    }
  }
}
