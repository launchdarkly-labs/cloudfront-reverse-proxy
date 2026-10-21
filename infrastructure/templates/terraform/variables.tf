variable "name" {
  description = "Prefix for resource names, like the CloudFormation stack name. Must be unique in the account (up to 50 characters)."
  type        = string
  default     = "ld-cloudfront-proxy"

  # The CloudFront Function name is "<name>-observability" and is limited to 64 characters.
  validation {
    condition     = can(regex("^[A-Za-z0-9_-]{1,50}$", var.name))
    error_message = "name must be 1-50 letters, numbers, hyphens or underscores."
  }
}

variable "domain_name" {
  description = "Custom domain for the proxy (e.g. flags.example.com). Creates an ACM certificate and Route 53 record. Leave empty to use the CloudFront domain."
  type        = string
  default     = ""
}

variable "hosted_zone_name" {
  description = "Public Route 53 hosted zone for domain_name. Defaults to domain_name without its first label (flags.example.com -> example.com). Required when domain_name is the zone apex."
  type        = string
  default     = ""
}

variable "price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_100"

  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.price_class)
    error_message = "price_class must be PriceClass_All, PriceClass_200 or PriceClass_100."
  }
}

variable "logging_bucket" {
  description = "Optional S3 bucket for CloudFront access logs (name only, no s3://). Leave empty to disable logging."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags for the distribution and certificate. To tag everything that supports tags, use the provider's default_tags instead (see examples/basic)."
  type        = map(string)
  default     = {}
}
