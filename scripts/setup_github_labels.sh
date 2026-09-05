#!/usr/bin/env bash
# ==============================================================================
# OmniTrack GitHub Labels Synchronization Script
# Uses GitHub CLI (gh) to populate the standardized open-source label taxonomy
# ==============================================================================

set -euo pipefail

REPO="OmmNoMi/omnitrack"

echo "Syncing standardized labels to GitHub repository: ${REPO}..."

# Array of label definitions: "Name|Color|Description"
LABELS=(
  "type: bug|d73a4a|Something is not working or behaving unexpectedly"
  "type: feature|a2eeef|New feature or major capability request"
  "type: enhancement|8ae234|Incremental improvement to existing functionality"
  "type: documentation|0075ca|Improvements or additions to documentation and guides"
  "type: performance|ff9f1c|Speed, query optimization, or memory efficiency improvements"
  "type: refactor|c5def5|Code restructuring without changing external behavior"
  "type: test|fef2c0|Adding or improving test suites and assertions"
  "area: split-shift|6f42c1|Split-shift engine, session definitions, and rotation patterns"
  "area: attendance|238636|Attendance synthesis, midnight cutoff, and check-in correlation"
  "area: task-sync|1f6feb|Multi-instance cross-site replication, HMAC signatures, and queue"
  "area: pai-engine|3fb950|Plan Adherence Index (PAI) calculation and variance policies"
  "area: live-timer|e3b341|Floating live stopwatch timer and quick-punch actions"
  "area: ui-ux|d4c5f9|GitHub-style heatmaps, desk workspace, and CSS/styling"
  "area: doctypes|bfdadc|DocType schema definitions, child tables, and field properties"
  "area: settings|5319e7|OmniTrack Settings control plane and role entitlements"
  "area: security|b60205|Security vulnerability, secret handling, or token authorization"
  "status: in-triage|ededed|New issue awaiting maintainer review and categorization"
  "status: planned|0e8a16|Accepted and scheduled for an upcoming milestone"
  "status: in-progress|fbca04|Active development currently underway"
  "status: blocked|b60205|Progress blocked on external dependency or prerequisite"
  "status: ready-for-review|0e8a16|PR or issue ready for code review and QA testing"
  "status: stale|ffffff|Inactive issue or PR marked for automatic closing"
  "priority: critical|b60205|Urgent blocker affecting production sites or core synthesis"
  "priority: high|d93f0b|High priority item for the next release"
  "priority: medium|fbca04|Standard priority item"
  "priority: low|0e8a16|Low priority or cosmetic improvement"
  "good first issue|7057ff|Great starting issue for new open-source contributors"
  "help wanted|008672|Extra attention or community contribution needed"
  "breaking change|d93f0b|Changes that break backward compatibility"
)

for item in "${LABELS[@]}"; do
  IFS='|' read -r name color desc <<< "$item"
  echo "Setting label: [${name}]..."
  gh label create "${name}" --repo "${REPO}" --color "${color}" --description "${desc}" --force 2>/dev/null || \
  gh label edit "${name}" --repo "${REPO}" --color "${color}" --description "${desc}" 2>/dev/null || true
done

echo "✅ All GitHub labels synchronized successfully!"
