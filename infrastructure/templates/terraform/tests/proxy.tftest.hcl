# Checks the proxy's routing and settings with a mocked AWS provider, so no AWS account is needed:
#   terraform init && terraform test

mock_provider "aws" {
  mock_data "aws_cloudfront_cache_policy" {
    defaults = { id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" }
  }
  mock_data "aws_cloudfront_origin_request_policy" {
    defaults = { id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" }
  }
  mock_data "aws_route53_zone" {
    defaults = { zone_id = "Z0000000000000000000" }
  }
  # The provider checks ARN format, so generated values need to look like ARNs.
  mock_resource "aws_cloudfront_function" {
    defaults = { arn = "arn:aws:cloudfront::123456789012:function/ld-cloudfront-proxy-observability" }
  }
  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000000"
      domain_validation_options = [{
        domain_name           = "flags.example.com"
        resource_record_name  = "_abc.flags.example.com."
        resource_record_type  = "CNAME"
        resource_record_value = "_xyz.acm-validations.aws."
      }]
    }
  }
  mock_resource "aws_acm_certificate_validation" {
    defaults = { certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000000" }
  }
}

run "cloudfront_domain" {
  command = apply

  assert {
    condition     = one([for o in aws_cloudfront_distribution.this.origin : o.custom_origin_config[0].origin_read_timeout if o.origin_id == "LDClientStreamOrigin"]) == 120
    error_message = "The streaming origin must have a 120s read timeout, or streams drop between heartbeats."
  }

  assert {
    condition     = alltrue([for o in aws_cloudfront_distribution.this.origin : o.custom_origin_config[0].origin_read_timeout == 30 if o.origin_id != "LDClientStreamOrigin"])
    error_message = "Only the streaming origin should change the 30s read timeout."
  }

  assert {
    condition     = [for b in aws_cloudfront_distribution.this.ordered_cache_behavior : b.path_pattern] == ["/v1/*", "/observability*", "/stream/eval/*", "/sdk/eval/users/*", "/eval/*", "/sdk/evalx/*", "/events/*", "/goals/*", "/sdk/*", "/stream/*", "/clientstream/*"]
    error_message = "Cache behaviors are missing or out of order."
  }

  assert {
    condition     = [for b in aws_cloudfront_distribution.this.ordered_cache_behavior : b.path_pattern if length(b.function_association) > 0] == ["/observability*"]
    error_message = "Only /observability* should run the path rewrite function."
  }

  assert {
    condition     = alltrue([for b in slice(aws_cloudfront_distribution.this.ordered_cache_behavior, 0, 2) : b.response_headers_policy_id == null || b.response_headers_policy_id == ""])
    error_message = "Observability routes must pass through the origins' CORS headers."
  }

  assert {
    condition     = contains(aws_cloudfront_response_headers_policy.cors.cors_config[0].access_control_expose_headers[0].items, "Date")
    error_message = "The CORS policy must expose the Date header."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.viewer_certificate[0].cloudfront_default_certificate && length(aws_route53_record.proxy) == 0 && length(aws_acm_certificate.this) == 0
    error_message = "Without domain_name, the CloudFront certificate is used and no certificate or DNS record is created."
  }

  assert {
    condition     = output.proxy_url == "https://${aws_cloudfront_distribution.this.domain_name}"
    error_message = "proxy_url should be the CloudFront domain."
  }
}

run "custom_domain" {
  command = apply

  variables {
    domain_name = "flags.example.com"
  }

  assert {
    condition     = local.hosted_zone_name == "example.com"
    error_message = "The hosted zone should default to the parent domain."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.aliases == toset(["flags.example.com"])
    error_message = "The distribution should use the custom domain."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.viewer_certificate[0].ssl_support_method == "sni-only" && aws_cloudfront_distribution.this.viewer_certificate[0].minimum_protocol_version == "TLSv1.2_2021"
    error_message = "The custom domain should use the ACM certificate over SNI with TLS 1.2."
  }

  assert {
    condition     = aws_route53_record.proxy[0].name == "flags.example.com" && aws_route53_record.proxy[0].type == "A"
    error_message = "An alias record should point the custom domain at the distribution."
  }

  assert {
    condition     = output.proxy_url == "https://flags.example.com"
    error_message = "proxy_url should be the custom domain."
  }
}

run "name_too_long" {
  command = plan

  variables {
    name = "a-name-that-is-much-too-long-for-a-cloudfront-function"
  }

  expect_failures = [var.name]
}
