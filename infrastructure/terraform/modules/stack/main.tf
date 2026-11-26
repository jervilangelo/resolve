# Resolve — Take every thought captive.
# Copyright © Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

# One complete Resolve environment. Environments differ only in the variables they pass.

locals {
  name_prefix = "resolve-${var.stage}"
  repo_root   = "${path.root}/../../../.."
  is_prod     = var.stage == "prod"
  # The hosted dashboard (when enabled) comes first: it is the address alert emails link to.
  web_origins = concat(
    var.enable_hosting ? distinct([module.hosting[0].origin, module.hosting[0].amplify_origin]) : [],
    var.web_origins,
  )
}

module "hosting" {
  count               = var.enable_hosting ? 1 : 0
  source              = "../hosting"
  name_prefix         = local.name_prefix
  repository          = var.repository
  github_access_token = var.github_access_token
  api_url             = module.api.endpoint
  cognito_domain      = module.identity.hosted_domain
  web_client_id       = module.identity.web_client_id
  contact_email       = var.alert_email
  custom_domain       = var.custom_domain
  extension_ids       = var.extension_ids
}

module "identity" {
  source                         = "../identity"
  name_prefix                    = local.name_prefix
  deletion_protection            = local.is_prod
  web_callback_urls              = [for origin in local.web_origins : "${origin}/auth/callback"]
  web_logout_urls                = local.web_origins
  enable_integration_test_client = !local.is_prod
  extension_callback_urls        = [for id in var.extension_ids : "https://${id}.chromiumapp.org/"]
  logo_light_svg                 = "${local.repo_root}/assets/branding/logo/horizontal-light.svg"
  logo_dark_svg                  = "${local.repo_root}/assets/branding/logo/horizontal-dark.svg"
}

module "data" {
  source                = "../data"
  name_prefix           = local.name_prefix
  deletion_protection   = local.is_prod
  force_destroy_buckets = !local.is_prod
}

module "api" {
  source               = "../api"
  permissions_boundary = var.permissions_boundary
  name_prefix          = local.name_prefix
  stage                = var.stage
  source_dir           = "${local.repo_root}/services/api/dist/api"
  table_name           = module.data.table_name
  table_arn            = module.data.table_arn
  issuer               = module.identity.issuer
  user_pool_id         = module.identity.user_pool_id
  user_pool_arn        = module.identity.user_pool_arn
  client_ids           = module.identity.api_client_ids
  rules_client_ids     = module.identity.rules_client_ids
  cors_allow_origins   = local.web_origins
  log_retention_days   = var.log_retention_days
}

module "notifications" {
  source               = "../notifications"
  permissions_boundary = var.permissions_boundary
  name_prefix          = local.name_prefix
  table_stream_arn     = module.data.table_stream_arn
  relay_source_dir     = "${local.repo_root}/services/notifications/dist/outbox-relay"
  worker_source_dir    = "${local.repo_root}/services/notifications/dist/delivery-worker"
  log_retention_days   = var.log_retention_days
  sender_email         = var.ses_sender_email
  sender_name          = var.ses_sender_name
  # An address on the custom domain is authorized by the domain identity (modules/domain).
  create_sender_identity = var.custom_domain == null || !endswith(coalesce(var.ses_sender_email, "-"), "@${coalesce(var.custom_domain, "-")}")
  table_name             = module.data.table_name
  table_arn              = module.data.table_arn
  user_pool_id           = module.identity.user_pool_id
  user_pool_arn          = module.identity.user_pool_arn
  dashboard_url          = local.web_origins[0]
}

module "observability" {
  source      = "../observability"
  name_prefix = local.name_prefix
  api_id      = module.api.api_id
  lambda_function_names = concat(
    [module.api.function_name, module.notifications.relay_function_name],
    module.notifications.worker_function_names,
  )
  alarm_queue_names  = [module.notifications.delivery_dlq_name, module.notifications.relay_failures_queue_name]
  stuck_queue_names  = [module.notifications.delivery_queue_name]
  monthly_budget_usd = var.monthly_budget_usd
  alert_email        = var.alert_email
}
