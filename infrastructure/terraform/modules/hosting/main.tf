# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

# The Next.js dashboard on AWS Amplify Hosting (server-side rendering, MASTER_PLAN §9). Amplify
# builds `apps/web` from the repository branch on every push and serves it on its own HTTPS
# address (https://<branch>.<app id>.amplifyapp.com) until a custom domain is attached.

locals {
  amplify_origin = "https://${var.branch}.${aws_amplify_app.this.default_domain}"
  # The public address: the custom domain once attached, otherwise Amplify's own.
  origin = var.custom_domain == null ? local.amplify_origin : "https://${var.custom_domain}"
}

# Encrypts the dashboard's session cookies. Lives only in Terraform state (encrypted bucket) and
# the Amplify build environment; rotating it signs everyone out.
resource "random_password" "session_secret" {
  length  = 48
  special = false
}

resource "aws_amplify_app" "this" {
  name         = "${var.name_prefix}-web"
  repository   = var.repository
  access_token = var.github_access_token
  platform     = "WEB_COMPUTE"

  # The token is needed only to connect the repository; later applies must not require it.
  lifecycle {
    ignore_changes = [access_token]
  }

  # Monorepo build: install from the repository root, build the web app, ship `.next`. Server
  # settings are written to .env.production so server-side code can read them at run time.
  build_spec = <<-YAML
    version: 1
    applications:
      - appRoot: apps/web
        frontend:
          phases:
            preBuild:
              commands:
                # Node 22 without the image's default global packages (they are not needed and
                # their downloads can fail); pnpm pinned to the repository's packageManager.
                - nvm install 22 --skip-default-packages && nvm use 22
                - npm install -g pnpm@10.34.9
                # Amplify's SSR runtime needs a hoisted node_modules for pnpm monorepos.
                - echo "node-linker=hoisted" >> ../../.npmrc
                # Only the dashboard and the workspace packages it uses.
                - cd ../.. && pnpm install --frozen-lockfile --filter "@resolve/web..." && cd apps/web
            build:
              commands:
                - env | grep -E '^(NEXT_PUBLIC_[A-Z_]+|RESOLVE_API_URL|COGNITO_DOMAIN|COGNITO_CLIENT_ID|SESSION_SECRET)=' > .env.production
                - pnpm run build
          artifacts:
            baseDirectory: .next
            files:
              - '**/*'
          cache:
            paths:
              - .next/cache/**/*
  YAML

  environment_variables = {
    AMPLIFY_MONOREPO_APP_ROOT = "apps/web"
  }
}

resource "aws_amplify_branch" "this" {
  app_id            = aws_amplify_app.this.id
  branch_name       = var.branch
  framework         = "Next.js - SSR"
  stage             = "PRODUCTION"
  enable_auto_build = true

  environment_variables = {
    NEXT_PUBLIC_SITE_URL      = local.origin
    NEXT_PUBLIC_CONTACT_EMAIL = coalesce(var.contact_email, "")
    # The setup checklist asks these extensions whether media blurring is on (public IDs).
    NEXT_PUBLIC_EXTENSION_IDS = join(",", var.extension_ids)
    RESOLVE_API_URL           = var.api_url
    COGNITO_DOMAIN            = var.cognito_domain
    COGNITO_CLIENT_ID         = var.web_client_id
    SESSION_SECRET            = random_password.session_secret.result
  }
}
