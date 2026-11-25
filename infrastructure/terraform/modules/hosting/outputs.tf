# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

output "origin" {
  description = "HTTPS origin of the hosted dashboard."
  value       = local.origin
}

output "app_id" {
  value = aws_amplify_app.this.id
}

output "amplify_origin" {
  description = "Amplify's own HTTPS address for the dashboard (always valid)."
  value       = local.amplify_origin
}
