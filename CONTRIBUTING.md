# Contributing to OmniTrack

We welcome contributions to **OmniTrack**!

## Development Workflow
1. Fork and clone the repository.
2. Link to your local Frappe bench:
   ```bash
   bench get-app https://github.com/OmmNoMi/omnitrack
   bench --site <your-site> install-app omnitrack
   ```
3. Run tests before submitting a Pull Request:
   ```bash
   bench --site <your-site> run-tests --app omnitrack
   ```

## Code Style
- Use `ruff` for Python linting and formatting.
- Follow Frappe Framework standards and naming conventions.
- Maintain WCAG 2.2 AA accessibility standards across UI components.
