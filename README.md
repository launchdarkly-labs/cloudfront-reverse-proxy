# AWS CloudFront Proxy for LaunchDarkly

An AWS CloudFront distribution that acts as a reverse proxy for LaunchDarkly client SDK and events APIs.  For when network calls need to come from a specific URL instead of LaunchDarkly.

> **⚠️ Disclaimer:** This is not an officially supported solution by LaunchDarkly.

> **Note:** All streaming endpoints use **no-cache policies** for real-time updates.

## Quick Start

### Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **AWS SSO login** (if using SSO)

### Check AWS Authentication

```bash
# Check if you're logged in
aws sts get-caller-identity

# If you get "Token has expired and refresh failed", re-login:
aws sso login --profile YOUR-PROFILE
```

## 🚀 One-Click Deploy

Deploy the CloudFront reverse proxy directly from the AWS Console with pre-configured settings.

| Region | Launch Stack | Console Link |
|--------|--------------|--------------|
| **US East (N. Virginia)** | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/cloudfront.yaml&stackName=ld-cloudfront-proxy&param_UseCustomDomain=false&param_PriceClass=PriceClass_100&param_EnableLogging=false) | [Text Link](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/cloudfront.yaml&stackName=ld-cloudfront-proxy&param_UseCustomDomain=false&param_PriceClass=PriceClass_100&param_EnableLogging=false) |
| **US East (Ohio)** | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-east-2#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/cloudfront.yaml&stackName=ld-cloudfront-proxy&param_UseCustomDomain=false&param_PriceClass=PriceClass_100&param_EnableLogging=false) | [Text Link](https://console.aws.amazon.com/cloudformation/home?region=us-east-2#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/cloudfront.yaml&stackName=ld-cloudfront-proxy&param_UseCustomDomain=false&param_PriceClass=PriceClass_100&param_EnableLogging=false) |
| **US West (Oregon)** | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/cloudfront.yaml&stackName=ld-cloudfront-proxy&param_UseCustomDomain=false&param_PriceClass=PriceClass_100&param_EnableLogging=false) | [Text Link](https://console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/cloudfront.yaml&stackName=ld-cloudfront-proxy&param_UseCustomDomain=false&param_PriceClass=PriceClass_100&param_EnableLogging=false) |
| **EU West (Ireland)** | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/cloudfront.yaml&stackName=ld-cloudfront-proxy&param_UseCustomDomain=false&param_PriceClass=PriceClass_100&param_EnableLogging=false) | [Text Link](https://console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/cloudfront.yaml&stackName=ld-cloudfront-proxy&param_UseCustomDomain=false&param_PriceClass=PriceClass_100&param_EnableLogging=false) |

You can deploy to any AWS region by changing `region=us-east-1` in the URL to your preferred region (e.g., `region=ap-southeast-1`).

**Template URL:** `https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/cloudfront.yaml`

The template is automatically updated via GitHub Actions when changes are merged to main for `infrastructure/cloudfront.yaml`

## Configuration Options

| Parameter | Default | Options | Description |
|-----------|---------|---------|-------------|
| `UseCustomDomain` | `false` | `true`/`false` | Use your own domain instead of CloudFront default |
| `DomainName` | `""` | Your domain | Required if UseCustomDomain=true (e.g., `flags.my-company.com`) - will auto-create certificate and DNS records |
| `PriceClass` | `PriceClass_100` | `PriceClass_100`/`200`/`All` | Coverage: US/Canada/Europe/Asia (100) vs Global (All) |
| `EnableLogging` | `false` | `true`/`false` | Enable CloudFront access logging |
| `LoggingBucket` | `""` | S3 bucket name | Required if EnableLogging=true |

### Price Class Options

- **PriceClass_100** (Recommended): US, Canada, Europe, Asia - Lowest cost
- **PriceClass_200**: Adds Middle East, Africa - Medium cost  
- **PriceClass_All**: Global coverage - Highest cost

### Limitations

> **Note:** Only one sub-domain address was tested (e.g., `flags.mydomain.com`). Behavior may be different or not work if you're trying to use multiple sub-domains such as `my.flags.mydomain.com`.



### Option 1: AWS CloudFront Reverse proxy with Custom DNS

**Deployment time:** ~15-20 minutes (CloudFront global propagation)

```bash
aws cloudformation deploy \
  --template-file templates/cloudfront.yaml \
  --stack-name ld-cloudfront-proxy \
  --parameter-overrides \
    UseCustomDomain=true \
    DomainName=flags.my-company-domain.com \
    PriceClass=PriceClass_100 \
  --capabilities CAPABILITY_IAM
```

Your reverse proxy URL will be the DomainName specified in the above command, but you can also run the below command to get it:
### Get Your Proxy URL

```bash
aws cloudformation describe-stacks \
  --stack-name ld-cloudfront-proxy \
  --query 'Stacks[0].Outputs' \
  --output table
```

This will return your CloudFront domain (e.g., `flags.my-company-domain.com`)


### Option 2: AWS CloudFront Reverse proxy with generic DNS

**Deployment time:** ~15-20 minutes (CloudFront global propagation)

```bash
cd infrastructure

aws cloudformation deploy \
  --template-file templates/cloudfront.yaml \
  --stack-name ld-cloudfront-proxy \
  --parameter-overrides \
    UseCustomDomain=false \
    PriceClass=PriceClass_100 \
    EnableLogging=false
```

### Get Your Proxy URL

```bash
aws cloudformation describe-stacks \
  --stack-name ld-cloudfront-proxy \
  --query 'Stacks[0].Outputs' \
  --output table
```

This will return your CloudFront domain: `d4a2b1c1d5e6f9.cloudfront.net`

## SDK Configuration

Once deployed, configure your LaunchDarkly SDKs to use your CloudFront proxy by specifying the options with the reverse proxy URL.

### React SDK (React Applications)
```javascript
const LDProvider = await asyncWithLDProvider({
  clientSideID: 'your-client-side-id',
  context: {
    kind: "device",
    key: "unique-device-id"
  },
  options: {
    baseUrl: 'https://flags.my-company-domain.com',
    eventsUrl: 'https://flags.my-company-domain.com', 
    streamUrl: 'https://flags.my-company-domain.com
  }
});
```

NOTE: You may need to restart your application.

## What Gets Deployed

### Infrastructure Resources
- **CloudFront Distribution** with 400+ global edge locations
- **Cache Policies:**
  - Standard Cache Policy (5min default TTL, 10min max TTL) - for flag evaluations
  - No-Cache Policy (0-1s TTL) - for streaming endpoints
- **Origin Request Policy** (forwards query strings and key headers)
- **Response Headers Policy** (CORS configuration for client-side SDKs)

### LaunchDarkly Origins
- **`clientsdk.launchdarkly.com`** - Default flag polling, goals, user evaluations
- **`clientstream.launchdarkly.com`** - Real-time streaming, SSE endpoints  
- **`events.launchdarkly.com`** - Event tracking and analytics
- **`app.launchdarkly.com`** - SDK management and extended APIs

## Cleanup

### Automated Cleanup (Recommended)
```bash
aws cloudformation deploy \
  --template-file templates/remove-cloudfront.yaml \
  --stack-name cleanup-ld-cloudfront \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides StackNameToDelete=ld-cloudfront-proxy
```

### Manual Cleanup
```bash
aws cloudformation delete-stack --stack-name ld-cloudfront-proxy
```

**Deletion time:** ~15-20 minutes (CloudFront global propagation)

## Monitoring & Troubleshooting

### Check Stack Status
```bash
aws cloudformation describe-stack-events --stack-name ld-cloudfront-proxy --output table
```

### Verify AWS Configuration
```bash
# Check current region
aws configure get region

# List AWS profiles  
aws configure list-profiles

# Test connectivity
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --output table
```

## SDK Compatibility

| SDK Type | Supported | Notes |
|----------|-----------|--------|
| **Client-side SDKs** | ✅ Yes | JavaScript, React, iOS, Android, Flutter |
| **Server-side SDKs** | ❌ No | Java, .NET, Python, Go, Node.js (server-side) |
| **Event Tracking** | ✅ Yes | From any SDK type |

**Note:** Server-side SDKs use different endpoints (`sdk.launchdarkly.com`) not currently proxied by this template.  The reverse proxy was not intended for server side use as the endpoints are not exposed to consumer bases.


## Multi-Project Usage

Different LaunchDarkly projects within the same organization can use different configurations:

- **Project A**: Uses CloudFront proxy (this reverse proxy setup)
- **Project B**: Connects directly to LaunchDarkly
- **Project C**: Uses a different proxy or region

Each project configures its SDK independently using different SDK keys and base URLs.

## Github Actions: Automated Template Deployment to s3 bucket

This repository includes a GitHub Actions workflow that automatically updates the S3-hosted CloudFormation templates when changes are merged to main.

## One-Click Cleanup

Remove your CloudFront proxy deployment and clean up all associated resources including DNS records and certificates.

### Cleanup Options

| Region | Launch Cleanup Stack | Console Link |
|--------|---------------------|--------------|
| **US East (N. Virginia)** | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/remove-cloudfront.yaml&stackName=cleanup-ld-cloudfront&param_StackNameToDelete=ld-cloudfront-proxy&param_CleanupDNS=true&param_CleanupCertificate=true) | [Text Link](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/remove-cloudfront.yaml&stackName=cleanup-ld-cloudfront&param_StackNameToDelete=ld-cloudfront-proxy&param_CleanupDNS=true&param_CleanupCertificate=true) |
| **US East (Ohio)** | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-east-2#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/remove-cloudfront.yaml&stackName=cleanup-ld-cloudfront&param_StackNameToDelete=ld-cloudfront-proxy&param_CleanupDNS=true&param_CleanupCertificate=true) | [Text Link](https://console.aws.amazon.com/cloudformation/home?region=us-east-2#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/remove-cloudfront.yaml&stackName=cleanup-ld-cloudfront&param_StackNameToDelete=ld-cloudfront-proxy&param_CleanupDNS=true&param_CleanupCertificate=true) |
| **US West (Oregon)** | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/remove-cloudfront.yaml&stackName=cleanup-ld-cloudfront&param_StackNameToDelete=ld-cloudfront-proxy&param_CleanupDNS=true&param_CleanupCertificate=true) | [Text Link](https://console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/remove-cloudfront.yaml&stackName=cleanup-ld-cloudfront&param_StackNameToDelete=ld-cloudfront-proxy&param_CleanupDNS=true&param_CleanupCertificate=true) |
| **EU West (Ireland)** | [![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/remove-cloudfront.yaml&stackName=cleanup-ld-cloudfront&param_StackNameToDelete=ld-cloudfront-proxy&param_CleanupDNS=true&param_CleanupCertificate=true) | [Text Link](https://console.aws.amazon.com/cloudformation/home?region=eu-west-1#/stacks/create/review?templateURL=https://ld-cloudfront-proxy-templates-09-25-25.s3.amazonaws.com/remove-cloudfront.yaml&stackName=cleanup-ld-cloudfront&param_StackNameToDelete=ld-cloudfront-proxy&param_CleanupDNS=true&param_CleanupCertificate=true) |

### Required Parameters

Before clicking cleanup, you'll need to provide:

- **StackNameToDelete**: Name of your CloudFront stack (default: `ld-cloudfront-proxy`)
- **DomainName**: Your custom domain (e.g., `flags.your-company.com`) - leave empty to skip DNS/cert cleanup
- **CleanupDNS**: Set to `true` to remove Route 53 DNS records
- **CleanupCertificate**: Set to `true` to remove ACM certificates

> **⚠️ Warning:** This will permanently delete your CloudFront proxy and all associated resources. Make sure you're ready before proceeding!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

