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
aws cloudformation validate-template --template-body file://infrastructure/templates/cloudfront.yaml

# Deploy test stack
aws cloudformation deploy \
  --template-file infrastructure/templates/cloudfront.yaml \
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

## Release Process

This project uses automated deployments via GitHub Actions and follows semantic versioning:

1. **Changes to `infrastructure/templates/cloudfront.yaml`** main branch trigger automatic S3 updates
2. **One-click deploy links** are automatically updated
3. **Templates are validated** before deployment

### Version Management

This project uses multiple version tracking methods:

#### 1. Git Tags (Primary)
```bash
# Create a new release version
git tag -a v1.1.0 -m "Add new caching policy for streaming endpoints"
git push origin v1.1.0

# List all versions
git tag -l
```

#### 2. VERSION File
Update the `VERSION` file in the repository root with the current version number.

#### 3. CloudFormation Template Metadata
Both CloudFormation templates include version metadata:
```yaml
Metadata:
  Version: '1.1.0'
  LastUpdated: '2024-10-08' 
  Author: 'AWS CloudFront Proxy for LaunchDarkly'
```

#### 4. GitHub Releases
Create GitHub releases from tags to provide user-facing release notes.

### Version Update Workflow

When creating a new release:

1. **Update VERSION file** with new version number
2. **Update CloudFormation template metadata** in both templates
3. **Update CHANGELOG.md** moving items from "Unreleased" to new version
4. **Commit changes** with message like "Bump version to v1.1.0"
5. **Create and push Git tag** `git tag -a v1.1.0 -m "Release description"`
6. **Create GitHub release** from the tag with release notes

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
