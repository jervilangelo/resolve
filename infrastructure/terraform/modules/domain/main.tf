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
