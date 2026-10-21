terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0, < 7.0"
    }
  }
}

# CloudFront only accepts ACM certificates from us-east-1. CloudFront and Route 53 are global, so
# everything is created there.
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = var.tags
  }
}
