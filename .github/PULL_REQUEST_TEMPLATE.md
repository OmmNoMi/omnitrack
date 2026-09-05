## 🎯 Summary of Changes
<!-- Provide a clear, concise summary of the purpose and scope of this Pull Request -->

### 🏷️ Change Type
- [ ] 🐛 Bug fix (non-breaking fix for an existing defect)
- [ ] ✨ New feature (non-breaking addition of new functionality)
- [ ] 💥 Breaking change (fix or feature that alters existing behavior or schema)
- [ ] ⚡ Performance optimization
- [ ] 📚 Documentation enhancement
- [ ] 🎨 UI/UX styling or accessibility improvement
- [ ] 🔧 Refactoring / Maintenance / CI

---

## 🔗 Related Issue(s)
<!-- Fixes #123, Closes #456, Relates to #789 -->
Closes: #

---

## 🧩 Architectural Impact
<!-- Detail any modifications to DocTypes, Frappe Hooks, Database Indexes, or API Endpoints -->
- **DocTypes Modified / Added:** 
- **Frappe Hooks Updated:** 
- **Database Schema & Migrations:** 

---

## 🧪 Testing & Verification
### Automated Tests
- [ ] Added / updated Python unit tests (`omnitrack.tests`)
- [ ] All test suites passing (`bench --site test.local run-tests --app omnitrack`)

### Manual Verification Steps
1. 
2. 
3. 

---

## 📸 Screenshots & Video Demos (Mandatory)
<!-- Please attach screenshots and/or video recordings demonstrating your changes -->

### Desktop View
| Before | After |
| :---: | :---: |
| *(Drag & drop Before screenshot)* | *(Drag & drop After screenshot)* |

### Mobile / Responsive View
| Mobile Before | Mobile After |
| :---: | :---: |
| *(Drag & drop Mobile Before)* | *(Drag & drop Mobile After)* |

### 🎬 Screen Recording / GIF (Optional for Complex Workflows)
<!-- Drag and drop video (.mp4/.mov) or animated GIF here -->

---

## 📋 Open Source & Frappe Standard Checklist
- [ ] My code adheres to the [Frappe Framework Coding Standards](https://frappeframework.com/docs/user/en/guidelines).
- [ ] Zero monkey-patching: all integrations strictly use Frappe hooks and standard doc events.
- [ ] Backward compatibility is preserved for existing database records.
- [ ] Executed `bench build --app omnitrack` with zero esbuild warnings/errors.
- [ ] No sensitive credentials, hardcoded domain URLs, or test tokens committed.
- [ ] All commit messages conform to [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`, `perf:`).
- [ ] Documentation (`docs/`) and `CHANGELOG.md` updated.
