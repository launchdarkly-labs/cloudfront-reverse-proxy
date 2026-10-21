output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.this.id
}

output "distribution_domain_name" {
  description = "CloudFront domain name"
  value       = aws_cloudfront_distribution.this.domain_name
}

output "certificate_arn" {
  description = "ACM certificate ARN (custom domain only)"
  value       = local.use_custom_domain ? aws_acm_certificate.this[0].arn : null
}

output "hosted_zone_id" {
  description = "Route 53 hosted zone ID used (custom domain only)"
  value       = local.use_custom_domain ? data.aws_route53_zone.this[0].zone_id : null
}

output "proxy_url" {
  description = "URL to use in your LaunchDarkly SDK configuration"
  value       = local.use_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.this.domain_name}"
}
