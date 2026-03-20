# ──────────────────────────────────────────────
# Outputs
# ──────────────────────────────────────────────

output "backend_public_ip" {
  description = "Public IP of the backend EC2 instance"
  value       = aws_eip.backend_eip.public_ip
}

output "backend_api_url" {
  description = "Backend API URL"
  value       = "http://${aws_eip.backend_eip.public_ip}:8000"
}

output "frontend_cloudfront_domain" {
  description = "CloudFront domain for the frontend"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_url" {
  description = "Frontend URL"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (used for cache invalidation)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_s3_bucket" {
  description = "S3 bucket name for frontend deployment"
  value       = aws_s3_bucket.frontend.bucket
}

output "dynamodb_table_name" {
  description = "DynamoDB incidents table name"
  value       = aws_dynamodb_table.incidents.name
}

output "sns_topic_arns" {
  description = "SNS topic ARNs for each department"
  value = {
    police   = aws_sns_topic.police.arn
    fire     = aws_sns_topic.fire.arn
    medical  = aws_sns_topic.medical.arn
    disaster = aws_sns_topic.disaster.arn
  }
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.backend.id
}
