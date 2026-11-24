# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

data "aws_region" "current" {}

output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.this.arn
}

output "issuer" {
  value = "https://cognito-idp.${data.aws_region.current.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}

output "web_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "integration_test_client_id" {
  value = one(aws_cognito_user_pool_client.integration_test[*].id)
}

# Every client whose access tokens the API accepts.
output "api_client_ids" {
  value = concat(
    [aws_cognito_user_pool_client.web.id],
    aws_cognito_user_pool_client.extension[*].id,
    aws_cognito_user_pool_client.integration_test[*].id,
  )
}

output "hosted_domain" {
  description = "Base URL of the Cognito managed login and OAuth endpoints."
  value       = "https://${aws_cognito_user_pool_domain.this.domain}.auth.${data.aws_region.current.region}.amazoncognito.com"
}

output "extension_client_id" {
  value = one(aws_cognito_user_pool_client.extension[*].id)
}
