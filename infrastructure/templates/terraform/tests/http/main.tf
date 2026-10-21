# Sends one request per route through a deployed proxy, as the SDK and observability plugins do.
# Used by integration.tftest.hcl.

terraform {
  required_version = ">= 1.7"

  required_providers {
    http = {
      source  = "hashicorp/http"
      version = ">= 3.4"
    }
  }
}

variable "proxy_url" {
  type = string
}

variable "client_side_id" {
  type = string
}

variable "context_key" {
  type = string
}

locals {
  # The SDK sends the context as unpadded base64url.
  context = replace(replace(trimsuffix(base64encode(jsonencode({ kind = "user", key = var.context_key })), "="), "+", "-"), "/", "_")
  headers = { Origin = "https://proxy-test.example", Content-Type = "application/json" }
  # A new DNS name can take a minute to resolve everywhere, so retry before failing.
  retry = { attempts = 12, min_delay_ms = 10000 }
}

data "http" "poll" {
  url             = "${var.proxy_url}/sdk/evalx/${var.client_side_id}/contexts/${local.context}"
  request_headers = { Origin = local.headers.Origin }
  retry {
    attempts     = local.retry.attempts
    min_delay_ms = local.retry.min_delay_ms
  }
}

data "http" "events" {
  url             = "${var.proxy_url}/events/bulk/${var.client_side_id}"
  method          = "POST"
  request_headers = local.headers
  request_body    = "[]"
  retry {
    attempts     = local.retry.attempts
    min_delay_ms = local.retry.min_delay_ms
  }
}

data "http" "otlp" {
  url             = "${var.proxy_url}/v1/traces"
  method          = "POST"
  request_headers = local.headers
  request_body    = jsonencode({ resourceSpans = [] })
  retry {
    attempts     = local.retry.attempts
    min_delay_ms = local.retry.min_delay_ms
  }
}

data "http" "observability" {
  url             = "${var.proxy_url}/observability"
  method          = "POST"
  request_headers = local.headers
  request_body    = jsonencode({ query = "{ __typename }" })
  retry {
    attempts     = local.retry.attempts
    min_delay_ms = local.retry.min_delay_ms
  }
}

output "poll" {
  value = { status = data.http.poll.status_code, headers = data.http.poll.response_headers, body = data.http.poll.response_body }
}

output "events" {
  value = { status = data.http.events.status_code, headers = data.http.events.response_headers }
}

output "otlp" {
  value = { status = data.http.otlp.status_code, headers = data.http.otlp.response_headers }
}

output "observability" {
  value = { status = data.http.observability.status_code, headers = data.http.observability.response_headers, body = data.http.observability.response_body }
}
