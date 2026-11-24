# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

resource "aws_cognito_user_pool" "this" {
  name                = "${var.name_prefix}-users"
  user_pool_tier      = "ESSENTIALS"
  deletion_protection = var.deletion_protection ? "ACTIVE" : "INACTIVE"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  username_configuration {
    case_sensitive = false
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 3
  }

  mfa_configuration = "OPTIONAL"
  software_token_mfa_configuration {
    enabled = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # The Cognito default sender is limited to low daily volumes; switch to SES once a verified
  # sending domain exists.
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }
}

# Public client for the Next.js dashboard: authorization code + PKCE, no client secret.
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.name_prefix}-web"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret                      = false
  explicit_auth_flows                  = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = var.web_callback_urls
  logout_urls                          = var.web_logout_urls

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  access_token_validity         = 60
  id_token_validity             = 60
  refresh_token_validity        = 30
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

# Server-side client for automated integration tests only (never enabled in prod).
resource "aws_cognito_user_pool_client" "integration_test" {
  count        = var.enable_integration_test_client ? 1 : 0
  name         = "${var.name_prefix}-integration-test"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret               = false
  explicit_auth_flows           = ["ALLOW_ADMIN_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors = "ENABLED"
  access_token_validity         = 15
  id_token_validity             = 15
  refresh_token_validity        = 1
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

# Cognito managed login (hosted sign-up, sign-in, recovery and MFA pages) on a Cognito domain.
# The prefix is globally unique, hence the random suffix.
resource "random_id" "domain" {
  byte_length = 3
}

resource "aws_cognito_user_pool_domain" "this" {
  domain                = "${var.name_prefix}-${random_id.domain.hex}"
  user_pool_id          = aws_cognito_user_pool.this.id
  managed_login_version = 2
}

# Cognito's asset sanitizer rejects SVG accessibility metadata (role, <title>); upload a copy
# without it. The artwork itself is unchanged.
locals {
  logo_light = replace(replace(file(var.logo_light_svg), "/ role=\"[^\"]*\"/", ""), "/<title>[^<]*</title>/", "")
  logo_dark  = replace(replace(file(var.logo_dark_svg), "/ role=\"[^\"]*\"/", ""), "/<title>[^<]*</title>/", "")
}

resource "aws_cognito_managed_login_branding" "web" {
  user_pool_id = aws_cognito_user_pool.this.id
  client_id    = aws_cognito_user_pool_client.web.id
  # Slate Resolve palette (docs/BRAND_GUIDELINES.md) over the full Cognito style schema; follows
  # the visitor's light/dark preference.
  settings = file("${path.module}/managed-login-settings.json")

  asset {
    category   = "FORM_LOGO"
    color_mode = "LIGHT"
    extension  = "SVG"
    bytes      = base64encode(local.logo_light)
  }

  asset {
    category   = "FORM_LOGO"
    color_mode = "DARK"
    extension  = "SVG"
    bytes      = base64encode(local.logo_dark)
  }

  depends_on = [aws_cognito_user_pool_domain.this]
}

# Public client for the browser extension: authorization code + PKCE through the browser identity
# API. Callbacks are https://<extension-id>.chromiumapp.org/ (Chrome, Edge, Brave).
resource "aws_cognito_user_pool_client" "extension" {
  count        = length(var.extension_callback_urls) > 0 ? 1 : 0
  name         = "${var.name_prefix}-extension"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret                      = false
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = var.extension_callback_urls

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  access_token_validity         = 60
  id_token_validity             = 60
  refresh_token_validity        = 30
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_managed_login_branding" "extension" {
  count        = length(var.extension_callback_urls) > 0 ? 1 : 0
  user_pool_id = aws_cognito_user_pool.this.id
  client_id    = aws_cognito_user_pool_client.extension[0].id
  settings     = file("${path.module}/managed-login-settings.json")

  asset {
    category   = "FORM_LOGO"
    color_mode = "LIGHT"
    extension  = "SVG"
    bytes      = base64encode(local.logo_light)
  }

  asset {
    category   = "FORM_LOGO"
    color_mode = "DARK"
    extension  = "SVG"
    bytes      = base64encode(local.logo_dark)
  }

  depends_on = [aws_cognito_user_pool_domain.this]
}
