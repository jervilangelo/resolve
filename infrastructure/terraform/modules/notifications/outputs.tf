# Resolve — Take every thought captive.
# Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.

output "delivery_queue_url" {
  value = aws_sqs_queue.delivery.url
}

output "delivery_queue_name" {
  value = aws_sqs_queue.delivery.name
}

output "delivery_dlq_name" {
  value = aws_sqs_queue.delivery_dlq.name
}

output "relay_failures_queue_name" {
  value = aws_sqs_queue.relay_failures.name
}

output "relay_function_name" {
  value = module.relay.function_name
}

output "sender_identity_arn" {
  value = one(aws_sesv2_email_identity.sender[*].arn)
}

output "worker_function_names" {
  description = "Delivery worker Lambda (empty when no sender email is configured)."
  value       = [for worker in module.worker : worker.function_name]
}
