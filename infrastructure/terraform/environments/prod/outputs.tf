# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

output "api_endpoint" {
  value = module.resolve.api_endpoint
}

output "user_pool_id" {
  value = module.resolve.user_pool_id
}

output "web_client_id" {
  value = module.resolve.web_client_id
}

output "integration_test_client_id" {
  value = module.resolve.integration_test_client_id
}

output "table_name" {
  value = module.resolve.table_name
}

output "hosted_domain" {
  value = module.resolve.hosted_domain
}

output "contact_email" {
  description = "Public privacy and support contact shown on the dashboard's legal pages."
  value       = var.alert_email
}

output "dashboard_url" {
  value = module.resolve.dashboard_url
}

output "github_deploy_role_arn" {
  value = module.github_deploy.role_arn
}

output "extension_client_id" {
  value = module.resolve.extension_client_id
}
