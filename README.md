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

The templates are automatically updated via GitHub Actions when changes to `infrastructure/templates/cloudfront.yaml` or `infrastructure/templates/remove-cloudfront.yaml` are merged to main

## Prerequisites for Custom Domain

When using a custom domain (`UseCustomDomain=true`), ensure the following prerequisites are met:

### Route 53 Hosted Zone

The custom domain must have a **public** Route 53 hosted zone in the same AWS account, and **Route 53 must be authoritative** for the domain (the domain's NS records at the registrar must point to Route 53 nameservers).

**What happens automatically:**
1. The template looks up the hosted zone for your domain (e.g., `example.com` for `flags.example.com`)
2. ACM creates an SSL certificate with DNS validation
3. ACM automatically creates DNS validation CNAME records in Route 53
4. CloudFormation waits for certificate validation to complete
5. CloudFront distribution is created with the validated certificate
6. DNS A record is created pointing to the CloudFront distribution

**Why DNS delegation matters:**
- ACM creates validation CNAME records in your Route 53 hosted zone
- For validation to succeed, public DNS queries must resolve to Route 53 (not CloudFlare, GoDaddy, etc.)
- If the domain is delegated elsewhere, ACM cannot see its own validation records and the certificate remains in `PENDING_VALIDATION` indefinitely

**Verify Route 53 is authoritative for your domain:**
```bash
# Check public DNS nameservers for your domain
dig +short NS yourdomain.com

# Get your Route 53 nameservers
aws route53 get-hosted-zone --id YOUR_HOSTED_ZONE_ID \
  --query "DelegationSet.NameServers" --output table

# These should match!
```

**If they don't match: this will not work!**
Alternatively, you may update your domain registrar's NS records to point to the Route 53 nameservers shown in the above command.  WARNING! This is a much larger change and should not be performed without understanding the full impact.

## Configuration Options

| Parameter | Default | Options | Description |
|-----------|---------|---------|-------------|
| `UseCustomDomain` | `false` | `true`/`false` | Use your own domain instead of CloudFront default |
| `DomainName` | `""` | Your domain | Required if UseCustomDomain=true (e.g., `flags.my-company.com`) - will auto-create certificate and DNS records |
| `PriceClass` | `PriceClass_100` | `PriceClass_100`/`200`/`All` | Coverage: US/Canada/Europe/Asia (100) vs Global (All) |
| `EnableLogging` | `false` | `true`/`false` | Enable CloudFront access logging |
| `LoggingBucket` | `""` | S3 bucket name | Required if EnableLogging=true |
| `PermissionsBoundaryArn` | `""` | Managed policy ARN | Optional permissions boundary for the hosted zone lookup role. The **Deploy proxy** workflow sets it (see [Option 4](#option-4-deploy-from-github-actions-in-your-fork)). |

### Price Class Options

- **PriceClass_100** (Recommended): US, Canada, Europe, Asia - Lowest cost
- **PriceClass_200**: Adds Middle East, Africa - Medium cost  
- **PriceClass_All**: Global coverage - Highest cost

### Limitations

> **Note:** Only one sub-domain address was tested (e.g., `flags.mydomain.com`). Behavior may be different or not work if you're trying to use multiple sub-domains such as `my.flags.mydomain.com`.

## Known Limitations

### Streaming Connection Timeout

> **⚠️ Important:** CloudFront closes an origin connection that sends nothing for longer than its origin response timeout (`OriginReadTimeout`). The default is **30 seconds**, which drops idle streaming connections between LaunchDarkly heartbeats. This template sets it to **120 seconds** on the `clientstream.launchdarkly.com` origin, the maximum without an AWS quota increase.

**Observed behavior** (October 2026, `clientstream.launchdarkly.com` through this proxy):
- Heartbeats arrived 61–90 seconds apart, inside the 120 second timeout
- A stream stayed open for the full 7 minute test with no reconnects
- With the 30 second default, the same stream closed after exactly 30 seconds

**If heartbeat gaps ever exceed 120 seconds:**
- Flag evaluations and updates continue to work correctly
- The LaunchDarkly SDK handles reconnection automatically
- Logs may show frequent connection retry events

**Workaround:** Request a quota increase for the CloudFront origin response timeout, then raise `OriginReadTimeout` on `LDClientStreamOrigin` in `infrastructure/templates/cloudfront.yaml` to match. This requires approval from AWS.


### Option 1: AWS CloudFront Reverse proxy with Custom DNS

**Deployment time:** ~15-20 minutes (CloudFront global propagation)

```bash
aws cloudformation deploy \
  --template-file infrastructure/templates/cloudfront.yaml \
  --stack-name ld-cloudfront-proxy \
  --parameter-overrides \
    UseCustomDomain=true \
    DomainName=flags.my-company-domain.com \
    PriceClass=PriceClass_100 \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
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
aws cloudformation deploy \
  --template-file infrastructure/templates/cloudfront.yaml \
  --stack-name ld-cloudfront-proxy \
  --parameter-overrides \
    UseCustomDomain=false \
    PriceClass=PriceClass_100 \
    EnableLogging=false \
  --region us-east-1
```

### Get Your Proxy URL

```bash
aws cloudformation describe-stacks \
  --stack-name ld-cloudfront-proxy \
  --query 'Stacks[0].Outputs' \
  --output table
```

This will return your CloudFront domain: `d4a2b1c1d5e6f9.cloudfront.net`

### Option 3: Terraform

`infrastructure/templates/terraform` is a Terraform module that creates the same proxy as the CloudFormation template, without the Lambda functions: the Route 53 hosted zone is looked up directly. `examples/basic` is a root configuration that calls it.

```bash
cd infrastructure/templates/terraform/examples/basic
terraform init
terraform apply -var name=ld-cloudfront-proxy -var domain_name=flags.my-company-domain.com
terraform output proxy_url
```

To remove the proxy, run `terraform destroy` with the same variables.

To call the module from your own configuration, copy `examples/basic`: it sets `source`, the provider, and a commented-out S3 backend. The module has no provider block of its own, so it uses your credentials and works with `count`, `for_each` and `depends_on`. Its AWS provider must be in `us-east-1`, the only region CloudFront accepts certificates from; the module stops with an error before creating a certificate anywhere else. Keep the state in a shared, locked backend such as S3 with `use_lockfile = true` rather than on one machine.

If `domain_name` is the zone apex (for example `example.com`), set `hosted_zone_name` to the same name; there is no parent zone to default to.

Changing `domain_name` on a running proxy creates and validates the new certificate first, switches the distribution to it, creates the new DNS record, and only then removes the old record and certificate. The proxy is unreachable for about 3 minutes while CloudFront deploys the switch: the old name stops working when the deployment starts, and the new one works when it finishes. Resolvers that looked up the new name before it existed can keep the failed lookup cached for the zone's negative TTL (15 minutes in a default Route 53 zone). To change domains without downtime, deploy a second proxy with a different `name` and move your SDKs to it.

The Terraform and provider versions below are the ones the tests pass on: Terraform 1.7.0 and 1.16.6, and the AWS provider 5.11.0, 5.100.0 and 6.69.1. The AWS provider before 5.11 can't create the `cloudfront-js-2.0` function.

<!-- BEGIN_TF_DOCS -->
##### Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.7 |
| aws | >= 5.11, < 7.0 |

##### Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| domain\_name | Custom domain for the proxy (e.g. flags.example.com). Creates an ACM certificate and Route 53 record. Leave empty to use the CloudFront domain. | `string` | `""` | no |
| hosted\_zone\_name | Public Route 53 hosted zone for domain\_name. Defaults to domain\_name without its first label (flags.example.com -> example.com). Required when domain\_name is the zone apex. | `string` | `""` | no |
| logging\_bucket | Optional S3 bucket for CloudFront access logs (name only, no s3://). Leave empty to disable logging. | `string` | `""` | no |
| name | Prefix for resource names, like the CloudFormation stack name. Must be unique in the account (up to 50 characters). | `string` | `"ld-cloudfront-proxy"` | no |
| price\_class | CloudFront price class. | `string` | `"PriceClass_100"` | no |
| tags | Tags for the distribution and certificate. To tag everything that supports tags, use the provider's default\_tags instead (see examples/basic). | `map(string)` | `{}` | no |

##### Outputs

| Name | Description |
|------|-------------|
| certificate\_arn | ACM certificate ARN (custom domain only) |
| distribution\_domain\_name | CloudFront domain name |
| distribution\_id | CloudFront distribution ID |
| hosted\_zone\_id | Route 53 hosted zone ID used (custom domain only) |
| proxy\_url | URL to use in your LaunchDarkly SDK configuration |
<!-- END_TF_DOCS -->

#### Testing the Terraform module

The offline tests check the routing (route order, the streaming timeout, the observability routes and CORS, certificate and DNS settings) and the input checks against a mocked AWS provider, so they need no credentials:

```bash
cd infrastructure/templates/terraform
terraform init
terraform test
```

Pull requests also run these linters, which you can run locally from the same directory. CI pins tflint v0.60.0, Trivy v0.76.1 and terraform-docs v0.21.0:

```bash
tflint --init && tflint --recursive   # includes tflint-ruleset-aws, see .tflint.hcl
trivy config --exit-code 1 .          # suppressions are inline in main.tf, each with its reason
terraform-docs .                      # regenerates the tables above; commit any change to README.md
```

The integration test deploys the proxy to a real AWS account with a custom domain, sends a request through the flag, events, `/v1/traces` and `/observability` routes, and then destroys everything, even when a check fails. It needs credentials for an account with a public Route 53 hosted zone for the domain, a Terraform version that allows `variable` blocks in test files (tested on 1.16.6), and takes about 10 minutes:

```bash
terraform init -test-directory=tests/integration
terraform test -test-directory=tests/integration \
  -var domain_name=proxy-test.my-company-domain.com \
  -var client_side_id=<client-side ID> \
  -var run_id=<unique ID>
```

To run it from GitHub Actions instead, see [CONTRIBUTING.md](CONTRIBUTING.md#terraform-integration-test-in-github-actions). Every resource that supports tags gets a `run-id` tag, so you can confirm nothing is left behind with `aws resourcegroupstaggingapi get-resources --tag-filters Key=run-id,Values=<unique ID>`. Route 53 records and CloudFront policies can't be tagged, so check those by name.

### Option 4: Deploy from GitHub Actions in your fork

Fork this repository, and the **Deploy proxy** workflow (`.github/workflows/deploy.yml`) deploys or destroys the proxy in your AWS account with Terraform or CloudFormation. In your fork, anyone with write access can run it. In `launchdarkly-labs/cloudfront-reverse-proxy` itself, only repository admins can.

The workflow signs in to AWS with GitHub's OpenID Connect (OIDC) tokens, so no AWS keys are stored in GitHub. Each run gets credentials that expire after an hour, and only if the role's trust policy accepts the run. The policies in `.github/iam` limit the role to the proxy's own resources:

| File | Attach it when | What it allows |
|---|---|---|
| `deploy-trust-policy.json` | Always, as the trust policy | Runs from the `deploy` environment, on `main`, in your fork (checked by repository and owner ID, which can't be reused after a rename) |
| `deploy-permissions-policy.json` | Always | The CloudFront distribution, cache policies and function; certificates for the proxy domain only; DNS changes only to the proxy's record and its certificate validation record, in one hosted zone |
| `deploy-terraform-state-policy.json` | You deploy with Terraform | The proxy's state and lock files in the state bucket |
| `deploy-cloudformation-policy.json` | You deploy with CloudFormation | The proxy's stack, and its hosted zone lookup function and role. The role can only be created with the boundary below attached, and the deploy role can't remove or change the boundary. |
| `hosted-zone-lookup-boundary-policy.json` | You deploy with CloudFormation, as a managed policy named `LDProxyHostedZoneLookupBoundary` | The most the lookup role can do: read hosted zones and write its own logs |

In every file, replace `ACCOUNT_ID`, `HOSTED_ZONE_ID`, `PROXY_NAME`, `PROXY_DOMAIN`, `TF_STATE_BUCKET`, `OWNER/REPO`, `REPOSITORY_ID` and `REPOSITORY_OWNER_ID`. Get the two IDs with `gh api repos/OWNER/REPO --jq '.id, .owner.id'`.

1. If the account doesn't have an IAM OIDC identity provider for `token.actions.githubusercontent.com` yet, [create one](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html) with the audience `sts.amazonaws.com`.
2. To deploy with Terraform, create a state bucket that blocks public access, keeps old versions of the state, and refuses unencrypted connections:

   ```bash
   aws s3api create-bucket --bucket "$TF_STATE_BUCKET" --region us-east-1
   aws s3api put-public-access-block --bucket "$TF_STATE_BUCKET" --public-access-block-configuration \
     BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   aws s3api put-bucket-versioning --bucket "$TF_STATE_BUCKET" --versioning-configuration Status=Enabled
   aws s3api put-bucket-policy --bucket "$TF_STATE_BUCKET" --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Deny\",\"Principal\":\"*\",\"Action\":\"s3:*\",\"Resource\":[\"arn:aws:s3:::${TF_STATE_BUCKET}\",\"arn:aws:s3:::${TF_STATE_BUCKET}/*\"],\"Condition\":{\"Bool\":{\"aws:SecureTransport\":\"false\"}}}]}"
   ```

3. To deploy with CloudFormation, create the boundary policy:

   ```bash
   aws iam create-policy --policy-name LDProxyHostedZoneLookupBoundary \
     --policy-document file://.github/iam/hosted-zone-lookup-boundary-policy.json
   ```

4. Create the role, and attach the policies for the tools you use:

   ```bash
   aws iam create-role --role-name GitHubActions-LDProxyDeploy \
     --assume-role-policy-document file://.github/iam/deploy-trust-policy.json
   aws iam put-role-policy --role-name GitHubActions-LDProxyDeploy --policy-name deploy \
     --policy-document file://.github/iam/deploy-permissions-policy.json
   aws iam put-role-policy --role-name GitHubActions-LDProxyDeploy --policy-name terraform-state \
     --policy-document file://.github/iam/deploy-terraform-state-policy.json
   aws iam put-role-policy --role-name GitHubActions-LDProxyDeploy --policy-name cloudformation \
     --policy-document file://.github/iam/deploy-cloudformation-policy.json
   ```

5. In your fork, go to **Settings** > **Environments** and create an environment named `deploy`:
   - Under **Deployment branches and tags**, choose **Selected branches and tags** and add only `main`. The trust policy also requires `main`, so a workflow edited on another branch gets neither the secrets nor AWS credentials.
   - Under **Required reviewers**, add the people who must approve each run before it gets credentials.
   - Add these secrets and variables:

   | Name | Kind | Value |
   |---|---|---|
   | `AWS_DEPLOY_ROLE_ARN` | Secret | The role from step 4 |
   | `PROXY_DOMAIN_NAME` | Secret, optional | Custom domain in the hosted zone, such as `flags.my-company-domain.com`, matching `PROXY_DOMAIN` in the policies. Leave it unset to use the CloudFront domain. It's a secret so GitHub masks it in the logs. |
   | `PROXY_NAME` | Variable, optional | Stack name and resource name prefix, matching `PROXY_NAME` in the policies. Defaults to `ld-cloudfront-proxy`. |
   | `TF_STATE_BUCKET` | Variable, Terraform only | The bucket from step 2. The state is stored at `<PROXY_NAME>/terraform.tfstate`. |

6. Protect `main` with a branch ruleset that requires an approved pull request, so a workflow change has to be reviewed before it can deploy.
7. Go to **Actions** > **Deploy proxy** > **Run workflow**, and choose `terraform` or `cloudformation` and `deploy`. The proxy URL is printed in the log of the deploy step.

To remove the proxy, run the workflow with the same tool, choose `destroy`, and type the proxy name in `confirm_destroy`. Use one tool per domain, because Terraform and CloudFormation don't know about each other's resources.

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
    streamUrl: 'https://flags.my-company-domain.com'
  }
});
```

NOTE: You may need to restart your application.

### Observability and Session Replay (Optional)

If you use the LaunchDarkly observability or session replay browser plugins, point them at the proxy too. These settings are client-side only and are optional: if you leave them out, the plugins send data directly to LaunchDarkly and the proxy's observability routes go unused.

```javascript
import Observability from '@launchdarkly/observability';
import SessionReplay from '@launchdarkly/session-replay';

// Add to the SDK options above
plugins: [
  new Observability({
    backendUrl: 'https://flags.my-company-domain.com/observability',
    otel: { otlpEndpoint: 'https://flags.my-company-domain.com' },
  }),
  new SessionReplay({
    backendUrl: 'https://flags.my-company-domain.com/observability',
  }),
]
```

| Plugin option | Proxy URL | LaunchDarkly URL |
|---|---|---|
| `otel.otlpEndpoint` | `https://<proxy>/v1/*` | `https://otel.observability.app.launchdarkly.com/v1/*` |
| `backendUrl` (both plugins) | `https://<proxy>/observability` | `https://pub.observability.app.launchdarkly.com/` |

Set `otlpEndpoint` to the proxy URL alone; the plugin adds `/v1/traces`, `/v1/metrics` and `/v1/logs`. Set `backendUrl` including `/observability`; the proxy removes that prefix before forwarding. Session replay has no separate URL: replay data is sent to `backendUrl`.

## What Gets Deployed

### Infrastructure Resources
- **CloudFront Distribution** with 400+ global edge locations
- **Cache Policies:**
  - Standard Cache Policy (5min default TTL, 10min max TTL) - for flag evaluations
  - No-Cache Policy (0-1s TTL) - for streaming endpoints
- **Origin Request Policy** (forwards query strings and key headers)
- **Response Headers Policy** (CORS configuration for client-side SDKs)
- **CloudFront Function** that removes the `/observability` prefix for the session replay route

With a custom domain, also:
- **ACM certificate** for the domain, validated with a DNS record in your Route 53 hosted zone
- **Route 53 alias record** pointing the domain at the distribution
- **Hosted zone lookup** (CloudFormation only): a Lambda function, and an IAM role for it, that find the hosted zone for your domain while the stack deploys. The role can only list and read hosted zones and write the function's logs. The Terraform module looks the zone up directly and creates no IAM roles or Lambda functions.

### LaunchDarkly Origins
- **`clientsdk.launchdarkly.com`** - Default flag polling, goals, user evaluations
- **`clientstream.launchdarkly.com`** - Real-time streaming, SSE endpoints  
- **`events.launchdarkly.com`** - Event tracking and analytics
- **`app.launchdarkly.com`** - SDK management and extended APIs
- **`otel.observability.app.launchdarkly.com`** - Observability traces, metrics and logs (`/v1/*`)
- **`pub.observability.app.launchdarkly.com`** - Observability sessions and session replay (`/observability`), through a CloudFront Function that removes the `/observability` prefix

The observability routes don't cache, forward every request header except `Host`, and pass through LaunchDarkly's own CORS headers.

## Cleanup

### Automated Cleanup (Recommended)
```bash
aws cloudformation deploy \
  --template-file infrastructure/templates/remove-cloudfront.yaml \
  --stack-name cleanup-ld-cloudfront \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    StackNameToDelete=ld-cloudfront-proxy \
    DomainName=flags.my-company-domain.com \
    CleanupDNS=true \
    CleanupCertificate=true \
  --region us-east-1
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

### Test for Streaming Connection Drops

If streaming connections are closed early, browser dev tools show the `eventsource` request ending in `(failed) net::ERR_HTTP2_PROTOCOL_ERROR`, and the SDK logs a stream error and reconnects. `tests/stream-drop` checks for this: it runs the LaunchDarkly React SDK in headless Chromium against your proxy, holds the stream open, and fails if the connection is ever closed and reopened. A second stream records each heartbeat, so a drop can be compared with the time since the last data.

```bash
cd tests/stream-drop
npm install
npx playwright install chromium
PROXY_URL=https://flags.my-company-domain.com CLIENT_SIDE_ID=your-client-side-id DURATION_SECONDS=480 npm test
```

The test exits `0` on pass and `1` on fail. Changing a flag during the run is optional; each update is logged.

### Performance Testing

`tests/perf` measures how much latency the proxy adds by sending the same traffic through the proxy and directly to LaunchDarkly, and comparing the two.

- `npm run http`: requests each proxied route (flag polling, streaming, events, observability traces and sessions) at a fixed concurrency, and reports p50/p90/p99 latency, errors, and CloudFront's cache status. The request bodies are empty, so no data is created in LaunchDarkly.
- `npm run sdk`: loads the LaunchDarkly React SDK in headless Chromium, alternating between the proxy and LaunchDarkly's default URLs, and reports how long each page takes to have flags. With `OBSERVABILITY=1` it also loads the observability and session replay plugins and times their requests. This creates real sessions, from service `proxy-perf-test`, in your project.

```bash
cd tests/perf
npm install
npx playwright install chromium
export PROXY_URL=https://flags.my-company-domain.com CLIENT_SIDE_ID=your-client-side-id
npm run http                     # REQUESTS=200 CONCURRENCY=10 STREAM_REQUESTS=30 by default
RUNS=10 OBSERVABILITY=1 npm run sdk
```

Both fail if any request through the proxy fails. Set `MAX_OVERHEAD_MS` to also fail `npm run http` when the proxy's median is that much slower than direct on any route.

Flag polling shows as `RefreshHit` rather than `Hit`: LaunchDarkly sends `Cache-Control: max-age=0` with an ETag, so CloudFront checks with LaunchDarkly on every request instead of serving a stored copy. This keeps flag values current.

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

## GitHub Actions Workflows

| Workflow | Runs | What it does |
|---|---|---|
| **Terraform checks** (`terraform.yml`) | On pull requests | Offline Terraform checks: fmt, validate, tests, tflint, Trivy and the docs tables. No AWS access. |
| **Deploy CloudFormation Template to S3** (`deploy-template-to-s3-bucket.yml`) | When the templates change on `main`, or by hand | Uploads the templates behind the one-click deploy buttons |
| **Deploy proxy** (`deploy.yml`) | By hand | Deploys or destroys the proxy in your AWS account. See [Option 4](#option-4-deploy-from-github-actions-in-your-fork). |
| **Terraform integration test** (`terraform-integration.yml`) | By hand, and before each release | Deploys the Terraform module to AWS, checks every route, and destroys it. See [CONTRIBUTING.md](CONTRIBUTING.md#terraform-integration-test-in-github-actions). |
| **Release** (`release.yml`) | When a `v*` tag is pushed | Publishes a GitHub release. See [CONTRIBUTING.md](CONTRIBUTING.md#releasing). |

The workflows that use AWS sign in with GitHub OIDC, so no AWS keys are stored in GitHub. In `launchdarkly-labs/cloudfront-reverse-proxy`, only repository admins can run them by hand or push a release tag. Forks don't have this restriction.

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

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

