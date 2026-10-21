# A root configuration that calls the proxy module. Copy this directory into your own repository and
# change source to "github.com/launchdarkly-labs/cloudfront-reverse-proxy//infrastructure/templates/terraform?ref=<tag>".

terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.11, < 7.0"
    }
  }

  # Keep state somewhere shared and locked rather than on one machine. use_lockfile needs Terraform 1.10.
  # backend "s3" {
  #   bucket       = "my-terraform-state"
  #   key          = "ld-cloudfront-proxy/terraform.tfstate"
  #   region       = "us-east-1"
  #   use_lockfile = true
  # }
}

# CloudFront only accepts ACM certificates from us-east-1.
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = var.tags
  }
}

module "proxy" {
  source = "../.."

  name        = var.name
  domain_name = var.domain_name
}

variable "name" {
  description = "Prefix for resource names. Must be unique in the account."
  type        = string
  default     = "ld-cloudfront-proxy"
}

variable "domain_name" {
  description = "Custom domain for the proxy, or empty to use the CloudFront domain."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags for every resource that supports them."
  type        = map(string)
  default     = {}
}

output "proxy_url" {
  description = "URL to use in your LaunchDarkly SDK configuration"
  value       = module.proxy.proxy_url
}
