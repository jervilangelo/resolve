# Resolve — Take every thought captive.
# Copyright © Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

output "name_servers" {
  description = "Set these as the domain's nameservers at the registrar."
  value       = aws_route53_zone.this.name_servers
}

output "zone_id" {
  value = aws_route53_zone.this.zone_id
}

output "ds_record" {
  description = "DS record to publish at the registrar (Namecheap) to complete DNSSEC."
  value = {
    key_tag     = aws_route53_key_signing_key.this.key_tag
    algorithm   = aws_route53_key_signing_key.this.signing_algorithm_type
    digest_type = aws_route53_key_signing_key.this.digest_algorithm_type
    digest      = aws_route53_key_signing_key.this.digest_value
  }
}
