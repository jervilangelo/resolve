# Resolve — Take every thought captive.
# Copyright © Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

output "table_name" {
  value = aws_dynamodb_table.main.name
}

output "table_arn" {
  value = aws_dynamodb_table.main.arn
}

output "table_stream_arn" {
  value = aws_dynamodb_table.main.stream_arn
}

output "avatars_bucket" {
  value = aws_s3_bucket.avatars.id
}
