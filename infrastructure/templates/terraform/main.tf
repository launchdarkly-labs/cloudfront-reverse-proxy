# CloudFront reverse proxy for LaunchDarkly client-side SDKs, events, and observability.
# Mirrors ../cloudfront.yaml; keep the two in sync.

locals {
  use_custom_domain = var.domain_name != ""
  hosted_zone_name  = var.hosted_zone_name != "" ? var.hosted_zone_name : join(".", slice(split(".", var.domain_name), 1, length(split(".", var.domain_name))))

  all_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
  read_methods = ["GET", "HEAD", "OPTIONS"]

  origins = {
    LDClientSdkOrigin = { domain = "clientsdk.launchdarkly.com", read_timeout = 30 }
    LDEventsOrigin    = { domain = "events.launchdarkly.com", read_timeout = 30 }
    LDSdkOrigin       = { domain = "sdk.launchdarkly.com", read_timeout = 30 }
    # SSE streams are idle between heartbeats; the 30s default drops them. 120s is the max without an AWS quota increase.
    LDClientStreamOrigin      = { domain = "clientstream.launchdarkly.com", read_timeout = 120 }
    LDAppOrigin               = { domain = "app.launchdarkly.com", read_timeout = 30 }
    LDObservabilityOtelOrigin = { domain = "otel.observability.app.launchdarkly.com", read_timeout = 30 }
    LDObservabilityPubOrigin  = { domain = "pub.observability.app.launchdarkly.com", read_timeout = 30 }
  }

  flag_routes = {
    cache_policy            = aws_cloudfront_cache_policy.standard.id
    origin_request_policy   = aws_cloudfront_origin_request_policy.ld.id
    response_headers_policy = aws_cloudfront_response_headers_policy.cors.id
  }
  stream_routes = merge(local.flag_routes, { cache_policy = aws_cloudfront_cache_policy.no_cache.id })

  # Observability and session replay. Both origins answer CORS themselves (otel echoes the Origin and
  # allows credentials), so no response headers policy overrides them, and every viewer header except
  # Host is forwarded.
  observability_routes = {
    cache_policy            = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy   = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    response_headers_policy = null
  }

  # Order matters: CloudFront uses the first path pattern that matches.
  cache_behaviors = [
    merge(local.observability_routes, { path = "/v1/*", origin = "LDObservabilityOtelOrigin", methods = local.all_methods, cached = ["GET", "HEAD"], compress = false, rewrite = false }),
    merge(local.observability_routes, { path = "/observability*", origin = "LDObservabilityPubOrigin", methods = local.all_methods, cached = ["GET", "HEAD"], compress = false, rewrite = true }),
    merge(local.stream_routes, { path = "/stream/eval/*", origin = "LDClientStreamOrigin", methods = local.read_methods, cached = ["GET", "HEAD"], compress = false, rewrite = false }),
    merge(local.flag_routes, { path = "/sdk/eval/users/*", origin = "LDClientSdkOrigin", methods = local.all_methods, cached = local.read_methods, compress = true, rewrite = false }),
    merge(local.stream_routes, { path = "/eval/*", origin = "LDClientStreamOrigin", methods = local.read_methods, cached = ["GET", "HEAD"], compress = false, rewrite = false }),
    merge(local.flag_routes, { path = "/sdk/evalx/*", origin = "LDAppOrigin", methods = local.all_methods, cached = local.read_methods, compress = true, rewrite = false }),
    merge(local.flag_routes, { path = "/events/*", origin = "LDEventsOrigin", methods = local.all_methods, cached = local.read_methods, compress = true, rewrite = false }),
    merge(local.flag_routes, { path = "/goals/*", origin = "LDClientSdkOrigin", methods = local.all_methods, cached = local.read_methods, compress = true, rewrite = false }),
    merge(local.flag_routes, { path = "/sdk/*", origin = "LDAppOrigin", methods = local.all_methods, cached = local.read_methods, compress = true, rewrite = false }),
    merge(local.stream_routes, { path = "/stream/*", origin = "LDClientStreamOrigin", methods = local.read_methods, cached = ["GET", "HEAD"], compress = false, rewrite = false }),
    merge(local.stream_routes, { path = "/clientstream/*", origin = "LDClientStreamOrigin", methods = local.read_methods, cached = ["GET", "HEAD"], compress = false, rewrite = false }),
  ]
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

# Custom domain: certificate, DNS validation and alias record.

data "aws_route53_zone" "this" {
  count        = local.use_custom_domain ? 1 : 0
  name         = local.hosted_zone_name
  private_zone = false
}

resource "aws_acm_certificate" "this" {
  count             = local.use_custom_domain ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"
  tags              = { Name = "${var.name}-certificate" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate_validation" {
  # The certificate covers one domain, so it has one validation record.
  count = local.use_custom_domain ? 1 : 0

  zone_id         = data.aws_route53_zone.this[0].zone_id
  name            = one(aws_acm_certificate.this[0].domain_validation_options).resource_record_name
  type            = one(aws_acm_certificate.this[0].domain_validation_options).resource_record_type
  records         = [one(aws_acm_certificate.this[0].domain_validation_options).resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  count                   = local.use_custom_domain ? 1 : 0
  certificate_arn         = aws_acm_certificate.this[0].arn
  validation_record_fqdns = [aws_route53_record.certificate_validation[0].fqdn]
}

resource "aws_route53_record" "proxy" {
  count   = local.use_custom_domain ? 1 : 0
  zone_id = data.aws_route53_zone.this[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}

# CloudFront policies and function.

resource "aws_cloudfront_response_headers_policy" "cors" {
  name    = "${var.name}-LDClientsdkCORS"
  comment = "CORS for LD client SDK proxy"

  cors_config {
    access_control_allow_credentials = false
    origin_override                  = true

    access_control_allow_headers {
      items = ["*"]
    }
    access_control_allow_methods {
      items = ["GET", "HEAD", "POST", "OPTIONS"]
    }
    access_control_allow_origins {
      items = ["*"]
    }
    # Date is what LaunchDarkly's events endpoint exposes; the browser SDK reads it from event responses.
    access_control_expose_headers {
      items = ["ETag", "Cache-Control", "Content-Type", "Date"]
    }
  }
}

resource "aws_cloudfront_origin_request_policy" "ld" {
  name    = "${var.name}-LDClientsdkOriginRequest"
  comment = "Forward all query strings and key preflight headers"

  cookies_config {
    cookie_behavior = "none"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers", "User-Agent"]
    }
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

resource "aws_cloudfront_cache_policy" "standard" {
  name        = "${var.name}-LDClientsdkCache"
  default_ttl = 300
  max_ttl     = 600
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Origin", "User-Agent"]
      }
    }
    query_strings_config {
      query_string_behavior = "all"
    }
  }
}

resource "aws_cloudfront_cache_policy" "no_cache" {
  name        = "${var.name}-LDStreamingNoCache"
  comment     = "Minimal cache policy for SSE streaming endpoints"
  default_ttl = 0
  max_ttl     = 1
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = false
    enable_accept_encoding_gzip   = false

    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "all"
    }
  }
}

# pub.observability.app.launchdarkly.com only serves POST /, so its traffic is sent to the proxy under
# /observability and the prefix is stripped before it reaches the origin.
resource "aws_cloudfront_function" "observability_path_rewrite" {
  name    = "${var.name}-observability"
  comment = "Strip the /observability prefix for pub.observability.app.launchdarkly.com"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      request.uri = request.uri.replace(/^\/observability/, '') || '/';
      return request;
    }
  EOT
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  comment             = "${var.name} - LaunchDarkly client SDK and events proxy"
  aliases             = local.use_custom_domain ? [var.domain_name] : []
  default_root_object = ""
  price_class         = var.price_class
  http_version        = "http2"
  is_ipv6_enabled     = true

  dynamic "origin" {
    for_each = local.origins
    content {
      origin_id   = origin.key
      domain_name = origin.value.domain

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
        origin_read_timeout    = origin.value.read_timeout
      }
    }
  }

  default_cache_behavior {
    target_origin_id           = "LDClientSdkOrigin"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = local.read_methods
    cached_methods             = local.read_methods
    cache_policy_id            = aws_cloudfront_cache_policy.standard.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.ld.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.cors.id
    compress                   = true
  }

  dynamic "ordered_cache_behavior" {
    for_each = local.cache_behaviors
    iterator = b
    content {
      path_pattern               = b.value.path
      target_origin_id           = b.value.origin
      viewer_protocol_policy     = "redirect-to-https"
      allowed_methods            = b.value.methods
      cached_methods             = b.value.cached
      cache_policy_id            = b.value.cache_policy
      origin_request_policy_id   = b.value.origin_request_policy
      response_headers_policy_id = b.value.response_headers_policy
      compress                   = b.value.compress

      dynamic "function_association" {
        for_each = b.value.rewrite ? [1] : []
        content {
          event_type   = "viewer-request"
          function_arn = aws_cloudfront_function.observability_path_rewrite.arn
        }
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !local.use_custom_domain
    acm_certificate_arn            = local.use_custom_domain ? aws_acm_certificate_validation.this[0].certificate_arn : null
    ssl_support_method             = local.use_custom_domain ? "sni-only" : null
    # CloudFront's default certificate only reports TLSv1, so asking for more causes a permanent diff.
    minimum_protocol_version = local.use_custom_domain ? "TLSv1.2_2021" : "TLSv1"
  }

  dynamic "logging_config" {
    for_each = var.logging_bucket != "" ? [1] : []
    content {
      bucket          = "${var.logging_bucket}.s3.amazonaws.com"
      include_cookies = false
      prefix          = "cloudfront-logs/"
    }
  }
}
