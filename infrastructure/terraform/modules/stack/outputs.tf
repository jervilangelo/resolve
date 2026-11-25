# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

output "api_endpoint" {
  value = module.api.endpoint
}

output "user_pool_id" {
  value = module.identity.user_pool_id
}

output "web_client_id" {
  value = module.identity.web_client_id
}

output "integration_test_client_id" {
  value = module.identity.integration_test_client_id
}

output "table_name" {
  value = module.data.table_name
}

output "avatars_bucket" {
  value = module.data.avatars_bucket
}

output "alerts_topic_arn" {
  value = module.observability.alerts_topic_arn
}

output "hosted_domain" {
  value = module.identity.hosted_domain
}

output "extension_client_id" {
  value = module.identity.extension_client_id
}

output "dashboard_url" {
  description = "Address alert emails link to (the hosted dashboard when enabled)."
  value       = local.web_origins[0]
}
