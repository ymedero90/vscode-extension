# Contributing to VS Code Extension

We love your input! We want to make contributing to this extension as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

### Pull Requests

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Make your changes
4. Test your changes:
   ```bash
   npm run test
   ```
5. Build the extension:
   ```bash
   npm run build
   ```
6. Package the extension:
   ```bash
   node build-vsix.js
   ```

## Testing

- Add tests for new functionality
- Ensure all existing tests pass before submitting a PR

## License

By contributing, you agree that your contributions will be licensed under the project's license.
