# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

# Keyless deploys from GitHub Actions via OIDC. Only workflow jobs that run in this repository's
# GitHub environment named after the stage can assume the role.
#
# The role can create IAM roles for this stack, but only roles carrying the stack's permissions
# boundary, which caps them at what Resolve's functions use. It cannot remove or change a
# boundary, or edit the boundary policy, so it cannot grant itself or anything else wider access.

resource "aws_iam_openid_connect_provider" "github" {
  count          = var.create_oidc_provider ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_openid_connect_provider" "github" {
  url        = "https://token.actions.githubusercontent.com"
  depends_on = [aws_iam_openid_connect_provider.github]
}

# The most any role created for this stack may ever do (the roles' own policies narrow it further).
data "aws_iam_policy_document" "boundary" {
  statement {
    sid = "StackFunctions"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "dynamodb:*",
      "sqs:*",
      "ses:SendEmail",
      "ses:SendRawEmail",
      "cognito-idp:ListUsers",
      "cognito-idp:AdminDeleteUser",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "boundary" {
  name        = "resolve-${var.stage}-boundary"
  description = "Permissions boundary for every role the Resolve ${var.stage} stack creates."
  policy      = data.aws_iam_policy_document.boundary.json
}

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["${var.github_subject_prefix}:environment:${var.stage}"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name                 = "github-deploy-resolve-${var.stage}"
  assume_role_policy   = data.aws_iam_policy_document.trust.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "power_user" {
  role       = aws_iam_role.deploy.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

# PowerUserAccess excludes IAM. Stack roles may be created and changed only with the boundary.
data "aws_iam_policy_document" "stack_iam" {
  statement {
    sid = "CreateAndChangeBoundedStackRoles"
    actions = [
      "iam:CreateRole",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:UpdateAssumeRolePolicy",
      "iam:PutRolePermissionsBoundary",
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/resolve-${var.stage}-*"]
    condition {
      test     = "StringEquals"
      variable = "iam:PermissionsBoundary"
      values   = [aws_iam_policy.boundary.arn]
    }
  }
  statement {
    sid = "ManageStackRoles"
    actions = [
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:UpdateRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:GetRolePolicy",
      "iam:PassRole",
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/resolve-${var.stage}-*"]
  }
  statement {
    sid       = "ReadBoundary"
    actions   = ["iam:GetPolicy", "iam:GetPolicyVersion", "iam:ListPolicyVersions"]
    resources = [aws_iam_policy.boundary.arn]
  }
  statement {
    sid       = "NeverLiftABoundary"
    effect    = "Deny"
    actions   = ["iam:DeleteRolePermissionsBoundary"]
    resources = ["*"]
  }
  statement {
    sid       = "ReadOwnRoleAndOidcProvider"
    actions   = ["iam:GetRole", "iam:ListRolePolicies", "iam:ListAttachedRolePolicies", "iam:GetRolePolicy", "iam:GetOpenIDConnectProvider"]
    resources = [aws_iam_role.deploy.arn, data.aws_iam_openid_connect_provider.github.arn]
  }
  statement {
    sid       = "LookUpOidcProvider"
    actions   = ["iam:ListOpenIDConnectProviders"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "stack_iam" {
  name   = "stack-iam"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.stack_iam.json
}
