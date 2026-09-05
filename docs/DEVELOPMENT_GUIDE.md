# 🛠️ OmniTrack Local Development & Contribution Guide

## Prerequisites
- Frappe Bench v15 or v16
- Python 3.10+ / 3.11+ / 3.14
- MariaDB 10.6+
- Redis Cache & Queue
- Node.js 18+ and Yarn

---

## 🚀 Quickstart Local Environment

```bash
# 1. Navigate to your frappe-bench directory
cd /path/to/frappe-bench

# 2. Get the OmniTrack app in editable mode
bench get-app https://github.com/OmmNoMi/omnitrack.git

# 3. Install on your development site
bench --site ommnomi.local install-app omnitrack

# 4. Run database migrations
bench --site ommnomi.local migrate

# 5. Build frontend assets
bench build --app omnitrack

# 6. Start the bench server
bench start
```

---

## 🧪 Running Automated Tests

```bash
bench --site ommnomi.local run-tests --app omnitrack
```

---

## 🌿 Branching & Commit Guidelines
- Use feature branches: `feat/<feature-name>`, `fix/<bug-name>`.
- Format commits following [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat: add split-shift template validation`
  - `fix: correct midnight cutoff window calculation`
  - `docs: update cross-site sync architecture guide`
