# Code Review Guidelines

When reviewing pull requests in this repository be sure to follow these rules:

## Code Style

- Steer towards simple and straightforward code. Expect pure functions when possible.
- Demand that code is easy to read and understand. Self-documenting is preferred over comments.
- Demand early returns when possible.
- Ignore formatting rules that will be covered by linters.
- Guard against architectural drift. Verify that new features strictly honor existingpatterns and conventions found in the codebase and documentation.

## Test Coverage and Maintainability

- Critically evaluate all new external dependencies. They must be justified against the goals of long-term maintainability, low maintenance and minimal dependency.

## Security

- Explicitly check security-sensitive code for patterns that could lead to broken authentication or authorization vulnerabilities.
- Immediately flag any potential hard-coded credentials (API keys, secrets, database passwords, etc.) found in the code.

## Examples

See `code-style.md` for examples of early returns and self-documenting code.
