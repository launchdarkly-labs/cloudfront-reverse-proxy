# AWS CloudFront Proxy for LaunchDarkly

A CloudFront distribution that acts as a reverse proxy for LaunchDarkly client SDK and events APIs.  For when network calls need to come from a specific URL instead of LaunchDarkly.

## Architecture

```
Your Application → CloudFront Edge → LaunchDarkly APIs
                     ↓ (cached)
```

### Endpoint Mappings

| **Path Pattern** | **Target Origin** | **LaunchDarkly Domain** | **Purpose** |
|-----------------|-------------------|-------------------------|-------------|
| `/` (default) | `LDClientSdkOrigin` | `clientsdk.launchdarkly.com` | Default flag polling |
| `/eval/*` | `LDClientStreamOrigin` | `clientstream.launchdarkly.com` | 🔄 **Streaming evaluations** |
| `/stream/*` | `LDClientStreamOrigin` | `clientstream.launchdarkly.com` | 🔄 **Real-time streaming** |
| `/stream/eval/*` | `LDClientStreamOrigin` | `clientstream.launchdarkly.com` | 🔄 **Combined streaming** |
| `/clientstream/*` | `LDClientStreamOrigin` | `clientstream.launchdarkly.com` | 🔄 **Alternative streaming** |
| `/events/*` | `LDEventsOrigin` | `events.launchdarkly.com` | 📊 Event tracking |
| `/goals/*` | `LDClientSdkOrigin` | `clientsdk.launchdarkly.com` | 🎯 Goal tracking |
| `/sdk/eval/users/*` | `LDClientSdkOrigin` | `clientsdk.launchdarkly.com` | 👤 User-specific evaluations |
| `/sdk/evalx/*` | `LDAppOrigin` | `app.launchdarkly.com` | 🔧 Extended evaluation APIs |
| `/sdk/*` | `LDAppOrigin` | `app.launchdarkly.com` | ⚙️ SDK management APIs |

> **Note:** All streaming endpoints (`/eval/*`, `/stream/*`, `/clientstream/*`) use **no-cache policies** for real-time updates.

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

### Deploy the CloudFront Proxy

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

**⏱️ Deployment time:** ~15-20 minutes (CloudFront global propagation)

### Get Your Proxy URL

```bash
aws cloudformation describe-stacks \
  --stack-name ld-cloudfront-proxy \
  --query 'Stacks[0].Outputs' \
  --output table
```

This will return your CloudFront domain (e.g., `d1a2b3c4d5e6f7.cloudfront.net`)

## Configuration Options

| Parameter | Default | Options | Description |
|-----------|---------|---------|-------------|
| `UseCustomDomain` | `false` | `true`/`false` | Use your own domain instead of CloudFront default |
| `DomainName` | `""` | Your domain | Required if UseCustomDomain=true (e.g., `flags.my-super-awesome-company.com`) |
| `AcmCertificateArn` | `""` | ACM ARN | Required if UseCustomDomain=true (must be in us-east-1) |
| `AutoCreateDNS` | `false` | `true`/`false` | **NEW:** Automatically create Route 53 DNS record |
| `HostedZoneId` | `""` | Route 53 Zone ID | Required if AutoCreateDNS=true (e.g., `Z1D633PJN98FT9`) |
| `PriceClass` | `PriceClass_100` | `PriceClass_100`/`200`/`All` | Coverage: US/Canada/Europe/Asia (100) vs Global (All) |
| `EnableLogging` | `false` | `true`/`false` | Enable CloudFront access logging |
| `LoggingBucket` | `""` | S3 bucket name | Required if EnableLogging=true |

### Price Class Options

- **PriceClass_100** (Recommended): US, Canada, Europe, Asia - Lowest cost
- **PriceClass_200**: Adds Middle East, Africa - Medium cost  
- **PriceClass_All**: Global coverage - Highest cost

### Custom Domain Setup Options

**⚠️ PREREQUISITES:** Before using `UseCustomDomain=true`, you must complete the following setup:

#### Step 1: Get Your Route 53 Hosted Zone ID
```bash
# Find your hosted zone ID (replace with your domain)
aws route53 list-hosted-zones --query 'HostedZones[?Name==`my-awesome-domain.com.`].[Id,Name]' --output table

# Example output: Zone ID like Z04794713N147BEH1NVCF
```

#### Step 2: Create ACM Certificate (Required)
```bash
# Request SSL certificate (MUST be in us-east-1 for CloudFront)
aws acm request-certificate \
  --domain-name ld.my-awesoome-domain.com \
  --validation-method DNS \
  --region us-east-1

# Save the Certificate ARN from the output!
```

#### Step 3: Validate Certificate
```bash
# Get DNS validation record details
aws acm describe-certificate --certificate-arn YOUR-CERT-ARN --region us-east-1

# Create validation record in Route 53 (replace with your values)
aws route53 change-resource-record-sets --hosted-zone-id YOUR-ZONE-ID --change-batch '{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "_validation-string.ld.my-awesome-domain.com.",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "_validation-value.acm-validations.aws."}]
    }
  }]
}'

# Verify certificate is issued (wait 1-2 minutes)
aws acm describe-certificate --certificate-arn YOUR-CERT-ARN --region us-east-1 \
  --query 'Certificate.Status' --output text
# Should return: ISSUED
```

#### Option 1: Automatic DNS (Recommended)
If you have a Route 53 hosted zone, the template can automatically create DNS records:

```bash
aws cloudformation deploy \
  --template-file templates/cloudfront.yaml \
  --stack-name ld-cloudfront-proxy \
  --parameter-overrides \
    UseCustomDomain=true \
    DomainName=ld.my-awesome-domain.com \
    AcmCertificateArn=my-awesome-arn \
    AutoCreateDNS=true \
    HostedZoneId=my-awesome-hosted-zone-id \
    PriceClass=PriceClass_100
```

## 📱 SDK Configuration

Once deployed, configure your LaunchDarkly SDKs to use your CloudFront proxy:

### React SDK (React Applications)
```javascript
const LDProvider = await asyncWithLDProvider({
  clientSideID: 'your-client-side-id',
  context: {
    kind: "device",
    key: "unique-device-id"
  },
  options: {
    baseUrl: 'https://ld.my-awesome-domain.com',
    eventsUrl: 'https://ld.my-awesome-domain.com', 
    streamUrl: 'https://ld.my-awesome-domain.com',
    streaming: true
  }
});
```


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

**⏱️ Deletion time:** ~15-20 minutes (CloudFront global propagation)

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

**Note:** Server-side SDKs use different endpoints (`sdk.launchdarkly.com`) not currently proxied by this template.

## Multi-Project Usage

Different LaunchDarkly projects within the same organization can use different configurations:

- **Project A**: Uses CloudFront proxy (this reverse proxy setup)
- **Project B**: Connects directly to LaunchDarkly
- **Project C**: Uses a different proxy or region

Each project configures its SDK independently using different SDK keys and base URLs.

## Contributing

1. Test changes in a development AWS account first
2. Validate CloudFormation templates before committing
3. Update documentation for any parameter changes
