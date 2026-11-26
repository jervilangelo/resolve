# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

# The production domain: DNS in Route 53 (the registrar points its nameservers here), the email
# sending domain with SPF, DKIM and DMARC so alerts are authenticated, and the dashboard's address.

data "aws_region" "current" {}

resource "aws_route53_zone" "this" {
  name    = var.domain
  comment = "Resolve production domain"
}

# ---- Email: send as no-reply@<domain>, signed (DKIM), with an aligned bounce domain (SPF) --------

resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain
  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = aws_route53_zone.this.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# Bounces go to mail.<domain>, so SPF passes for (and aligns with) the sending domain.
resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity         = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain       = "mail.${var.domain}"
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "aws_route53_record" "mail_from_mx" {
  zone_id = aws_route53_zone.this.zone_id
  name    = "mail.${var.domain}"
  type    = "MX"
  ttl     = 1800
  records = ["10 feedback-smtp.${data.aws_region.current.region}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  zone_id = aws_route53_zone.this.zone_id
  name    = "mail.${var.domain}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com -all"]
}

# The domain itself sends no other mail.
resource "aws_route53_record" "root_spf" {
  zone_id = aws_route53_zone.this.zone_id
  name    = var.domain
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com -all"]
}

# Receivers quarantine mail that fails authentication, protecting the domain from spoofing.
resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.this.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=quarantine; adkim=s; aspf=r; pct=100"]
}

# ---- Dashboard: Amplify serves the apex and www (certificate and records managed by Amplify) -------

resource "aws_amplify_domain_association" "dashboard" {
  count                 = var.enable_dashboard ? 1 : 0
  app_id                = var.amplify_app_id
  domain_name           = var.domain
  wait_for_verification = false

  sub_domain {
    branch_name = var.amplify_branch
    prefix      = ""
  }
  sub_domain {
    branch_name = var.amplify_branch
    prefix      = "www"
  }
}

# ---- DNSSEC: Route 53 signs the zone; the registrar publishes the DS record ----------------------

data "aws_caller_identity" "current" {}

resource "aws_kms_key" "dnssec" {
  provider                 = aws.us_east_1
  description              = "DNSSEC key-signing key for ${var.domain}"
  customer_master_key_spec = "ECC_NIST_P256"
  key_usage                = "SIGN_VERIFY"
  deletion_window_in_days  = 30
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AccountAdministers"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "Route53DnssecUsesKey"
        Effect    = "Allow"
        Principal = { Service = "dnssec-route53.amazonaws.com" }
        Action    = ["kms:DescribeKey", "kms:GetPublicKey", "kms:Sign"]
        Resource  = "*"
        Condition = {
          StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
          ArnLike      = { "aws:SourceArn" = "arn:aws:route53:::hostedzone/*" }
        }
      },
      {
        Sid       = "Route53DnssecGrants"
        Effect    = "Allow"
        Principal = { Service = "dnssec-route53.amazonaws.com" }
        Action    = "kms:CreateGrant"
        Resource  = "*"
        Condition = { Bool = { "kms:GrantIsForAWSResource" = "true" } }
      },
    ]
  })
}

resource "aws_kms_alias" "dnssec" {
  provider      = aws.us_east_1
  name          = "alias/resolve-dnssec-${replace(var.domain, ".", "-")}"
  target_key_id = aws_kms_key.dnssec.key_id
}

resource "aws_route53_key_signing_key" "this" {
  hosted_zone_id             = aws_route53_zone.this.id
  key_management_service_arn = aws_kms_key.dnssec.arn
  name                       = "resolve"
}

resource "aws_route53_hosted_zone_dnssec" "this" {
  hosted_zone_id = aws_route53_key_signing_key.this.hosted_zone_id
  depends_on     = [aws_route53_key_signing_key.this]
}

# ---- Query logging: which resolvers asked for the domain (no visitor browsing) --------------------

resource "aws_cloudwatch_log_group" "dns_queries" {
  provider          = aws.us_east_1
  name              = "/aws/route53/${var.domain}"
  retention_in_days = 30
}

data "aws_iam_policy_document" "dns_query_logs" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:us-east-1:${data.aws_caller_identity.current.account_id}:log-group:/aws/route53/*"]
    principals {
      type        = "Service"
      identifiers = ["route53.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_cloudwatch_log_resource_policy" "dns_queries" {
  provider        = aws.us_east_1
  policy_name     = "resolve-route53-query-logs"
  policy_document = data.aws_iam_policy_document.dns_query_logs.json
}

resource "aws_route53_query_log" "this" {
  zone_id                  = aws_route53_zone.this.zone_id
  cloudwatch_log_group_arn = aws_cloudwatch_log_group.dns_queries.arn
  depends_on               = [aws_cloudwatch_log_resource_policy.dns_queries]
}
