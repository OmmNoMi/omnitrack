# OmniTrack Developer & Agent Guidelines

These rules apply to all tasks in the **`omnitrack`** repository.

## Brand Standards
- The company name MUST ALWAYS be written as **`OmmNoMi`** or **`OmmNoMi Automation LLP`** in footers.
- Brand Colors:
  - Blue (Ethical & Excellence): `#4285F4`
  - Green (Ecological & Equity): `#34A853`
  - Red (Entrepreneurial): `#EA4335`
  - Yellow (Enthusiasm): `#FBBC05`
  - Purple (Empowerment): `#673AB7`

## Git Attribution & Policy
- Follow strict OmmNoMi bench guidelines: do not include AI co-authorship trailers in git commits.
- Commits and pushes are strictly made on user instruction with author identity `OmmNoMi Automation <ommnomi.automation@gmail.com>`.

## Frappe Engineering Rules
- **100% Configuration Driven**: Keep all features toggleable via `OmniTrack Settings`.
- **Zero Monkey Patching**: Standard hooks, DocEvents, and Permission Queries only.
- **REST & HMAC Security**: All inter-bench live sync endpoints must sign and verify payloads via SHA-256 HMAC.
