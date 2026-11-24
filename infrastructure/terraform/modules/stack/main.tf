# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

# One complete Resolve environment. Environments differ only in the variables they pass.

locals {
  name_prefix = "resolve-${var.stage}"
  repo_root   = "${path.root}/../../../.."
  is_prod     = var.stage == "prod"
}

module "identity" {
  source                         = "../identity"
  name_prefix                    = local.name_prefix
  deletion_protection            = local.is_prod
  web_callback_urls              = [for origin in var.web_origins : "${origin}/auth/callback"]
  web_logout_urls                = var.web_origins
  enable_integration_test_client = !local.is_prod
  logo_light_svg                 = "${local.repo_root}/assets/branding/logo/stacked-light.svg"
  logo_dark_svg                  = "${local.repo_root}/assets/branding/logo/stacked-dark.svg"
}

module "data" {
  source                = "../data"
  name_prefix           = local.name_prefix
  deletion_protection   = local.is_prod
  force_destroy_buckets = !local.is_prod
}

module "api" {
  source             = "../api"
  name_prefix        = local.name_prefix
  stage              = var.stage
  source_dir         = "${local.repo_root}/services/api/dist/api"
  table_name         = module.data.table_name
  table_arn          = module.data.table_arn
  issuer             = module.identity.issuer
  client_ids         = module.identity.api_client_ids
  cors_allow_origins = var.web_origins
  log_retention_days = var.log_retention_days
}

module "notifications" {
  source             = "../notifications"
  name_prefix        = local.name_prefix
  table_stream_arn   = module.data.table_stream_arn
  relay_source_dir   = "${local.repo_root}/services/notifications/dist/outbox-relay"
  log_retention_days = var.log_retention_days
  sender_email       = var.ses_sender_email
}

module "observability" {
  source                = "../observability"
  name_prefix           = local.name_prefix
  api_id                = module.api.api_id
  lambda_function_names = [module.api.function_name, module.notifications.relay_function_name]
  alarm_queue_names     = [module.notifications.delivery_dlq_name, module.notifications.relay_failures_queue_name]
  monthly_budget_usd    = var.monthly_budget_usd
  alert_email           = var.alert_email
}
