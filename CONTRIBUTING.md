# Contributing to AWS CloudFront Proxy for LaunchDarkly

Thank you for your interest in contributing to this project! We welcome contributions from the community.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors. Please be kind, professional, and constructive in all interactions.

## How to Contribute

### Reporting Issues

Before creating a new issue, please:

1. **Search existing issues** to avoid duplicates
2. **Use a clear, descriptive title** that summarizes the problem
3. **Provide detailed information** including:
   - Steps to reproduce the issue
   - Expected vs. actual behavior
   - AWS region and CloudFormation stack details
   - LaunchDarkly SDK version and configuration
   - Error messages or logs (sanitized of sensitive data)

### Suggesting Enhancements

We welcome suggestions for new features or improvements:

1. **Check existing issues** to see if your idea has been discussed
2. **Create a new issue** with the "enhancement" label
3. **Describe the enhancement** including:
   - Use case and problem it solves
   - Proposed solution
   - Any alternatives considered
   - Potential impact on existing users

### Pull Requests

1. **Fork the repository** and create a feature branch
2. **Make your changes** following the guidelines below
3. **Test your changes** thoroughly
4. **Update documentation** as needed
5. **Submit a pull request** with a clear description

#### Pull Request Guidelines

- Use a clear, descriptive title
- Reference any related issues (e.g., "Fixes #123")
- Provide a detailed description of changes
- Include testing instructions
- Keep changes focused and atomic

## Development Guidelines

### CloudFormation Templates

- **Validate templates** using `aws cloudformation validate-template`
- **Follow AWS best practices** for resource naming and tagging
- **Use parameters** for configurable values
- **Include comprehensive outputs** for important resource references
- **Add detailed descriptions** for parameters and resources

#### Template Structure
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Clear, concise description'

Parameters:
  # Parameters with descriptions and constraints

Resources:
  # Resources with logical names and proper dependencies

Outputs:
  # Important outputs with descriptions
```

### Documentation

- **Keep README.md updated** with any new features or changes
- **Use clear, actionable language** in documentation
- **Include examples** for configuration options
- **Test all documented commands** to ensure they work
- **Update deployment tables** if adding new regions

### Testing

#### Manual Testing Checklist

Before submitting changes, please verify:

- [ ] CloudFormation template validates without errors
- [ ] Stack deploys successfully in at least one AWS region
- [ ] Custom domain configuration works (if applicable)
- [ ] LaunchDarkly SDK can connect through the proxy
- [ ] Streaming endpoints work correctly
- [ ] Stack cleanup completes successfully
- [ ] One-click deploy links work correctly

#### Testing Commands

```bash
# Validate CloudFormation template
aws cloudformation validate-template --template-body file://infrastructure/templates/cloudformation/cloudfront.yaml

# Deploy test stack
aws cloudformation deploy \
  --template-file infrastructure/templates/cloudformation/cloudfront.yaml \
  --stack-name test-ld-cloudfront-proxy \
  --parameter-overrides UseCustomDomain=false \
  --capabilities CAPABILITY_IAM

# Test SDK connectivity (replace with your values)
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

# Cleanup test stack
aws cloudformation delete-stack --stack-name test-ld-cloudfront-proxy
```

#### Terraform Integration Test in GitHub Actions

`.github/workflows/terraform.yml` runs the offline Terraform checks on every pull request. `.github/workflows/terraform-integration.yml` deploys the module to AWS, checks every route, destroys everything, and fails if anything tagged with its run ID or any DNS record for the test domain is left. Start it from the Actions tab (**Terraform integration test** > **Run workflow**) before merging changes to the proxy. The release doesn't run it.

It runs in a GitHub environment named `integration`, which needs three secrets:

| Secret | Value |
|---|---|
| `AWS_INTEGRATION_ROLE_ARN` | IAM role the environment can assume through GitHub OIDC |
| `TEST_DOMAIN_NAME` | Domain to deploy to, such as `proxy-ci.my-company-domain.com`, in a public Route 53 hosted zone |
| `LD_CLIENT_SIDE_ID` | LaunchDarkly client-side ID |

All three are secrets so GitHub masks them wherever they appear in the workflow logs. That keeps the test domain out of the logs, but not out of public view: ACM certificates are published in Certificate Transparency logs, and the DNS records resolve while a run is deploying.

Create the role from the policies in `.github/iam`, replacing `ACCOUNT_ID`, `HOSTED_ZONE_ID` and `TEST_DOMAIN_NAME`. The trust policy only accepts jobs in this repository's `integration` environment that run from `main`, so a pull request or another branch can't use it. The permissions policy only allows DNS changes to the test domain and its certificate validation record, and certificates for the test domain:

```bash
aws iam create-role --role-name GitHubActions-CloudFrontProxyIntegration \
  --assume-role-policy-document file://.github/iam/integration-trust-policy.json
aws iam put-role-policy --role-name GitHubActions-CloudFrontProxyIntegration \
  --policy-name terraform-integration \
  --policy-document file://.github/iam/integration-permissions-policy.json
```

In this repository, only admins can run the integration test, the release and a manual template upload; each workflow checks with `.github/scripts/require-admin.sh` before it reads any secrets. Forks skip the check. A workflow edited on a branch could leave the check out, so these settings are what actually enforce it:

- The `integration` environment's **Deployment branches and tags** allow only `main`. The trust policy also requires `main`.
- `main` needs an approved pull request, so the workflows on `main` are reviewed.
- Optionally, required reviewers on the environment approve each run.

## Releasing

Releases are published by `.github/workflows/release.yml`, which an admin starts by hand.

1. In a pull request, set the version in `cloudfront.yaml` and `remove-cloudfront.yaml`: `Metadata.Version` to `'X.Y.Z'`, `LastUpdated` to the date, and the `(vX.Y.Z)` at the end of `Description`.
2. After it merges, go to **Actions** > **Release** > **Run workflow**, keep `main` as the branch, and enter the version (`X.Y.Z`). Or run `gh workflow run release.yml -f version=X.Y.Z`.

The workflow stops unless it runs from `main`, the version looks like `X.Y.Z` and isn't tagged yet, and both templates have that version. It then reruns the offline Terraform checks, creates the `vX.Y.Z` tag on the commit it checked, and publishes the release. It doesn't run the AWS integration test: what's on `main` has already been tested before it merged.

The release has:

- **Notes:** how to deploy that version with CloudFormation or Terraform, and GitHub's generated list of the pull requests merged since the last release. There's no CHANGELOG file: pull request titles are the changelog, so write them for someone reading the release.
- **Assets:** `cloudfront.yaml`, `remove-cloudfront.yaml`, the Terraform module as a `.tar.gz`, and `SHA256SUMS`.

Publishing a release doesn't change the one-click deploy templates: `deploy-template-to-s3-bucket.yml` still uploads them to S3 on every merge to `main`.

## Style Guidelines

### CloudFormation

- Use **PascalCase** for resource logical names
- Use **kebab-case** for parameter names
- Include **descriptions** for all parameters and important resources
- Group related resources together
- Use consistent indentation (2 spaces)

### Documentation

- Use **clear, concise language**
- Include **code examples** where helpful
- Use **consistent formatting** for commands and code
- Keep **line lengths reasonable** (80-100 characters)

## Versioning

This project follows [semantic versioning](https://semver.org/). A version is recorded in two places: the `vX.Y.Z` tag and GitHub release that the release workflow creates (see [Releasing](#releasing)), and the `Metadata.Version` in both CloudFormation templates. Merges to `main` that change the templates upload them to S3 for the one-click deploy buttons, whether or not there's a release.

### Branch Strategy

- **`main` branch** contains production-ready code
- **Feature branches** should be created from `main`
- **Pull requests** should target `main`

## Getting Help

If you need help or have questions:

1. **Check existing issues** and documentation first
2. **Create a new issue** with the "question" label
3. **Provide context** about what you're trying to achieve

## Recognition

Contributors will be recognized in the project. Significant contributions may be highlighted in release notes.

## License

By contributing to this project, you agree that your contributions will be licensed under the Apache License 2.0, the same license that covers the project. See the [LICENSE](LICENSE) file for details.

---

Thank you for contributing to make this CloudFront reverse proxy solution better for everyone! 🚀
