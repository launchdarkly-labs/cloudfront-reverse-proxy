# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Apache 2.0 License
- CONTRIBUTING.md with development guidelines and testing procedures
- CHANGELOG.md to track project changes
- `tests/stream-drop`: headless browser test that fails if the proxy closes and reopens the LaunchDarkly streaming connection
- Optional observability and session replay routes: `/v1/*` to `otel.observability.app.launchdarkly.com` and `/observability` to `pub.observability.app.launchdarkly.com`

### Changed
- Updated README.md to include license section

### Fixed
- Lambda runtimes moved from deprecated `python3.9` to `python3.13` in both templates
- Streaming connections no longer drop every 30 seconds: `OriginReadTimeout` set to 120 seconds on the `clientstream.launchdarkly.com` origin
- CORS policy now exposes the `Date` header, which the browser SDK reads from event responses
- README: Option 2 deploy command no longer runs `cd infrastructure` before using a repo-relative path
- README: missing closing quote on `streamUrl` in the React SDK example
- README: GitHub Actions template paths corrected to `infrastructure/templates/`
- README: streaming timeout limitation rewritten with measured heartbeat intervals

## [1.0.0] - 2024-10-08

### Added
- Initial CloudFront reverse proxy CloudFormation template
- Support for custom domain configuration with automatic certificate and DNS management
- Multiple price class options (PriceClass_100, PriceClass_200, PriceClass_All)
- CloudFront access logging configuration
- Automated cleanup template for removing proxy resources
- One-click deploy buttons for multiple AWS regions
- GitHub Actions workflow for automated S3 template deployment
- Comprehensive README with setup instructions and SDK configuration examples
- Support for LaunchDarkly client-side SDKs (JavaScript, React, iOS, Android, Flutter)
- Cache policies optimized for LaunchDarkly endpoints:
  - Standard caching for flag evaluations (5min default TTL)
  - No-cache policy for streaming endpoints (0-1s TTL)
- Origin request policy for proper header and query string forwarding
- CORS configuration for client-side SDK compatibility

### Infrastructure
- CloudFront Distribution with global edge locations
- Multiple LaunchDarkly origin configurations:
  - `clientsdk.launchdarkly.com` - Flag polling and evaluations
  - `clientstream.launchdarkly.com` - Real-time streaming
  - `events.launchdarkly.com` - Event tracking
  - `app.launchdarkly.com` - SDK management
- Route 53 DNS record creation for custom domains
- ACM certificate provisioning and validation
- S3 bucket configuration for access logging (optional)

### Documentation
- Multi-region deployment instructions
- Custom domain setup guide
- SDK configuration examples for React applications
- Monitoring and troubleshooting guides
- Cleanup procedures (both automated and manual)
- Price class comparison and recommendations
- Multi-project usage guidelines

---

## Release Notes

### Version Format
- **Major versions** (x.0.0): Breaking changes or significant new features
- **Minor versions** (x.y.0): New features, backwards compatible
- **Patch versions** (x.y.z): Bug fixes, backwards compatible

### Categories
- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security-related changes
- **Infrastructure**: AWS resource or template changes

### Links
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)

[Unreleased]: https://github.com/your-org/cloudfront-reverse-proxy/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/cloudfront-reverse-proxy/releases/tag/v1.0.0
