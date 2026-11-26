# Resolve — Take every thought captive.
# Copyright © Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

output "role_arn" {
  value = aws_iam_role.deploy.arn
}

output "boundary_arn" {
  description = "Permissions boundary every stack role must carry."
  value       = aws_iam_policy.boundary.arn
}
