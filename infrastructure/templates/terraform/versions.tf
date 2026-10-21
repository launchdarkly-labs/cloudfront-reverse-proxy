terraform {
  # 1.7 is the first release whose `terraform test` can mock providers, which the offline tests need.
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # 5.11 is the first release that accepts the cloudfront-js-2.0 function runtime.
      version = ">= 5.11, < 7.0"
    }
  }
}

# This module has no provider block, so it can be called with count, for_each and depends_on, and uses
# the caller's credentials. The caller's provider must be in us-east-1, the only region CloudFront
# accepts ACM certificates from; see examples/basic.
