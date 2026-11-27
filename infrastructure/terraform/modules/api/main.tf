# Resolve — Take every thought captive.
# Copyright © Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

locals {
  # Must match the route keys in services/api/src/routes.ts.
  routes = {
    "GET /v1/health"                                              = false
    "GET /v1/me"                                                  = true
    "DELETE /v1/me"                                               = true
    "PATCH /v1/me"                                                = true
    "POST /v1/groups"                                             = true
    "GET /v1/groups"                                              = true
    "GET /v1/groups/{groupId}"                                    = true
    "PATCH /v1/groups/{groupId}"                                  = true
    "DELETE /v1/groups/{groupId}"                                 = true
    "PATCH /v1/groups/{groupId}/members/{userId}"                 = true
    "POST /v1/groups/{groupId}/domains"                           = true
    "GET /v1/groups/{groupId}/domains"                            = true
    "DELETE /v1/groups/{groupId}/domains/{domain}"                = true
    "PATCH /v1/groups/{groupId}/domains/{domain}"                 = true
    "GET /v1/groups/{groupId}/domains/audit"                      = true
    "GET /v1/extension/rules"                                     = true
    "GET /v1/groups/{groupId}/members"                            = true
    "DELETE /v1/groups/{groupId}/members/{userId}"                = true
    "POST /v1/groups/{groupId}/leave"                             = true
    "POST /v1/groups/{groupId}/invitations"                       = true
    "GET /v1/groups/{groupId}/invitations"                        = true
    "DELETE /v1/groups/{groupId}/invitations/{invitationId}"      = true
    "POST /v1/invitations/preview"                                = true
    "POST /v1/invitations/accept"                                 = true
    "POST /v1/events"                                             = true
    "GET /v1/groups/{groupId}/accountability"                     = true
    "PUT /v1/groups/{groupId}/accountability/sharing"             = true
    "PUT /v1/groups/{groupId}/accountability/receiving"           = true
    "PUT /v1/groups/{groupId}/accountability/senders/{userId}"    = true
    "DELETE /v1/groups/{groupId}/accountability/senders/{userId}" = true
    "PUT /v1/groups/{groupId}/accountability/alert-types"         = true
    "POST /v1/extension/installations"                            = true
    "POST /v1/extension/installations/{installationId}/checkin"   = true
    # Installation-token routes (§7.4): the extension may already be removed or signed out, so the
    # random installation token in the body is the credential, checked by the function.
    "POST /v1/installations/removed" = false
    "POST /v1/installations/revoke"  = false
  }

  # The scheduled inactivity check is bundled next to the API (services/api/dist/<handler>).
  inactivity_source_dir = "${dirname(var.source_dir)}/inactivity"
}

# Only what the current routes use, scoped by partition-key prefix; widen together with new routes.
# The API cannot touch outbox items directly.
data "aws_iam_policy_document" "table_access" {
  statement {
    sid       = "GetUserGroupAndInvitationItems"
    actions   = ["dynamodb:GetItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["USER#*", "GROUP#*", "INVITE#*"]
    }
  }
  statement {
    sid       = "BatchGetProfilesAndGroups"
    actions   = ["dynamodb:BatchGetItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["USER#*", "GROUP#*"]
    }
  }
  statement {
    sid       = "QueryGroupPartitions"
    actions   = ["dynamodb:Query"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["GROUP#*"]
    }
  }
  statement {
    sid       = "QueryMembershipIndex"
    actions   = ["dynamodb:Query"]
    resources = ["${var.table_arn}/index/GSI1"]
    # The index is only ever read for one user's memberships.
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["USER#*"]
    }
  }
  statement {
    sid       = "PutUserGroupAndInvitationItems"
    actions   = ["dynamodb:PutItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["USER#*", "GROUP#*", "INVITE#*", "OUTBOX#*"]
    }
  }
  statement {
    sid       = "DissolveGroupItems"
    actions   = ["dynamodb:BatchWriteItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["GROUP#*", "INVITE#*"]
    }
  }
  statement {
    sid       = "ChangeGroupAndInvitationItems"
    actions   = ["dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:ConditionCheckItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["GROUP#*", "INVITE#*"]
    }
  }
  statement {
    # Self-service account deletion: the user's own partition, then their sign-in. (BatchWrite
    # also permits puts; the function already writes USER# items, so this adds no new reach.)
    sid       = "DeleteOwnUserData"
    actions   = ["dynamodb:Query", "dynamodb:BatchWriteItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["USER#*"]
    }
  }
  statement {
    # Installation alerts (§7.4): an enrolled browser and its uninstall-token pointer are written,
    # read and deleted together (the pointer lives in its own partition).
    sid = "InstallationItems"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:BatchWriteItem",
    ]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["USER#*", "INSTALLTOKEN#*"]
    }
  }
  statement {
    sid       = "DeleteOwnAccount"
    actions   = ["cognito-idp:AdminDeleteUser"]
    resources = [var.user_pool_arn]
  }
  statement {
    sid       = "CountUserSubmissions"
    actions   = ["dynamodb:UpdateItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["USER#*"]
    }
  }
}

module "function" {
  source               = "../lambda"
  permissions_boundary = var.permissions_boundary
  name                 = "${var.name_prefix}-api"
  source_dir           = var.source_dir
  policy_json          = data.aws_iam_policy_document.table_access.json
  log_retention_days   = var.log_retention_days
  environment = {
    STAGE              = var.stage
    LOG_LEVEL          = "info"
    TABLE_NAME         = var.table_name
    ALLOWED_CLIENT_IDS = join(",", var.client_ids)
    RULES_CLIENT_IDS   = join(",", var.rules_client_ids)
    USER_POOL_ID       = var.user_pool_id
  }
}

resource "aws_apigatewayv2_api" "this" {
  name          = "${var.name_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET", "POST", "PATCH", "PUT", "DELETE"]
    allow_headers = ["authorization", "content-type", "idempotency-key"]
    max_age       = 600
  }
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.this.id
  name             = "cognito"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    issuer   = var.issuer
    audience = var.client_ids
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.function.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 10000
}

resource "aws_apigatewayv2_route" "this" {
  #checkov:skip=CKV_AWS_309:Health and the two installation-token routes are unauthenticated by design (the token in the body is checked by the function); every other route uses the JWT authorizer.
  for_each           = local.routes
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = each.key
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = each.value ? "JWT" : "NONE"
  authorizer_id      = each.value ? aws_apigatewayv2_authorizer.cognito.id : null
}

resource "aws_cloudwatch_log_group" "access" {
  name              = "/aws/apigateway/${var.name_prefix}-api"
  retention_in_days = var.log_retention_days
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = var.throttle_burst
    throttling_rate_limit  = var.throttle_rate
  }

  # Route templates only: no paths, query strings, IPs or user agents (section 13).
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.access.arn
    format = jsonencode({
      requestId = "$context.requestId"
      routeKey  = "$context.routeKey"
      status    = "$context.status"
      latencyMs = "$context.responseLatency"
      authError = "$context.authorizer.error"
    })
  }
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = module.function.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

# ---- Scheduled inactivity check (§7.4) ------------------------------------------------------------

# Reads overdue installations, the group's members and choices; writes the alert with the mark.
data "aws_iam_policy_document" "inactivity_access" {
  statement {
    sid       = "QueryDueInstallations"
    actions   = ["dynamodb:Query"]
    resources = ["${var.table_arn}/index/GSI1"]
    condition {
      test     = "ForAllValues:StringEquals"
      variable = "dynamodb:LeadingKeys"
      values   = ["INSTALL_DUE"]
    }
  }
  statement {
    sid       = "ReadGroupsAndProfiles"
    actions   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:BatchGetItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["GROUP#*", "USER#*"]
    }
  }
  statement {
    sid       = "MarkInstallationAndWriteAlert"
    actions   = ["dynamodb:UpdateItem", "dynamodb:PutItem"]
    resources = [var.table_arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["USER#*", "OUTBOX#*"]
    }
  }
}

module "inactivity" {
  source               = "../lambda"
  permissions_boundary = var.permissions_boundary
  name                 = "${var.name_prefix}-inactivity"
  source_dir           = local.inactivity_source_dir
  policy_json          = data.aws_iam_policy_document.inactivity_access.json
  log_retention_days   = var.log_retention_days
  timeout              = 60
  environment = {
    STAGE      = var.stage
    LOG_LEVEL  = "info"
    TABLE_NAME = var.table_name
  }
}

# Hourly: with a 72-hour grace period, an alert goes out between 72 and 73 hours after the last
# check-in (contracts: INACTIVITY_GRACE_HOURS, INACTIVITY_SCAN_INTERVAL_MINUTES).
resource "aws_cloudwatch_event_rule" "inactivity" {
  name                = "${var.name_prefix}-inactivity-check"
  description         = "Resolve: alert partners about enrolled browsers that stopped checking in"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "inactivity" {
  rule = aws_cloudwatch_event_rule.inactivity.name
  arn  = module.inactivity.function_arn
}

resource "aws_lambda_permission" "inactivity" {
  statement_id  = "AllowHourlyInactivityCheck"
  action        = "lambda:InvokeFunction"
  function_name = module.inactivity.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.inactivity.arn
}
