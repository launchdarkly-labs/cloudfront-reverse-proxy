# Deploys the proxy to a real AWS account, sends a request through each route, then destroys
# everything, even when an assertion fails. Needs AWS credentials, a public Route 53 hosted zone for
# the domain, and a LaunchDarkly client-side ID. It's kept out of tests/ so the offline tests still run on
# Terraform 1.7, which doesn't allow variable blocks in test files:
#
#   terraform init -test-directory=tests/integration
#   terraform test -test-directory=tests/integration \
#     -var domain_name=proxy-test.example.com -var client_side_id=<id> -var run_id=<unique id>
#
# Takes about 10 minutes, most of it CloudFront deploying and deleting the distribution.

variable "run_id" {
  description = "Unique ID for this run, added to every resource as the run-id tag."
  type        = string
}

variable "client_side_id" {
  description = "LaunchDarkly client-side ID"
  type        = string
}

provider "aws" {
  region = "us-east-1"

  # Lets a cleanup check find anything this run leaves behind:
  #   aws resourcegroupstaggingapi get-resources --tag-filters Key=run-id,Values=<run_id>
  default_tags {
    tags = { run-id = var.run_id }
  }
}

run "deploy" {
  command = apply

  variables {
    name = "ld-proxy-it-${substr(sha1(var.run_id), 0, 8)}"
    tags = { purpose = "integration-test" }
  }

  assert {
    condition     = output.proxy_url == "https://${var.domain_name}"
    error_message = "proxy_url should be the custom domain."
  }

  assert {
    condition     = aws_acm_certificate_validation.this[0].certificate_arn == aws_acm_certificate.this[0].arn
    error_message = "The certificate should be validated before the distribution uses it."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.status == "Deployed"
    error_message = "The distribution should finish deploying."
  }
}

run "routes" {
  command = apply

  module {
    source = "./tests/http"
  }

  variables {
    proxy_url   = run.deploy.proxy_url
    context_key = "tf-integration-${var.run_id}"
  }

  assert {
    condition     = output.poll.status == 200 && can(jsondecode(output.poll.body))
    error_message = "Flag polling through the proxy returned HTTP ${output.poll.status}."
  }

  assert {
    condition     = output.poll.headers["Access-Control-Allow-Origin"] == "*"
    error_message = "Flag routes should answer with the proxy's CORS policy."
  }

  assert {
    condition     = output.events.status == 202
    error_message = "Events through the proxy returned HTTP ${output.events.status}."
  }

  assert {
    condition     = output.otlp.status == 200
    error_message = "OTLP traces through the proxy (/v1/traces) returned HTTP ${output.otlp.status}."
  }

  assert {
    condition     = output.observability.status == 200 && strcontains(output.observability.body, "__typename")
    error_message = "Session GraphQL through the proxy (/observability) returned HTTP ${output.observability.status}."
  }

  # The proxy's own CORS policy answers "*" without credentials, so an echoed Origin with credentials
  # can only have come from the otel origin.
  assert {
    condition     = output.otlp.headers["Access-Control-Allow-Origin"] == "https://proxy-test.example" && output.otlp.headers["Access-Control-Allow-Credentials"] == "true"
    error_message = "Observability routes should pass through the origin's CORS headers instead of the proxy's policy."
  }
}
