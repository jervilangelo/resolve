# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

# Keyless deploys from GitHub Actions via OIDC. Only workflow jobs that run in this repository's
# GitHub environment named after the stage can assume the role.
#
# The role can create IAM roles for this stack, so anyone able to run workflows in that GitHub
# environment is effectively an administrator of the account. Keep environment protection rules on
# and move Resolve to a dedicated AWS account (docs/MASTER_PLAN.md section 9) to contain this.

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
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
      values   = ["repo:${var.github_repository}:environment:${var.stage}"]
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

# PowerUserAccess excludes IAM; allow managing only this stack's Lambda roles.
data "aws_iam_policy_document" "stack_iam" {
  statement {
    sid = "ManageStackRoles"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:UpdateRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:GetRolePolicy",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:PassRole",
    ]
    resources = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/resolve-${var.stage}-*"]
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
