# 🏛️ OmniTrack System Architecture

## Overview
OmniTrack is structured as a modular Frappe application designed to seamlessly extend Frappe HRMS, ERPNext, and Frappe Desk without invasive patches.

---

## 🏗️ DocType Ecosystem

```
+-------------------------------------------------------------+
|                      OmniTrack Settings                     |
|  (Split-Shift Engine, Midnight Cutoff, Cross-Site Policies)  |
+-------------------------------------------------------------+
         |                                           |
         v                                           v
+------------------------+                 +---------------------+
| OmniTrack Shift        |                 | OmniTrack Task      |
| Template               |                 | Sync                |
+------------------------+                 +---------------------+
         | (Child Table: Sessions)                   |
         v                                           v
+------------------------+                 +---------------------+
| OmniTrack Shift Split  |                 | OmniTrack Remote    |
| Assignment             |                 | Connection          |
+------------------------+                 +---------------------+
         |
         v (Synthesizer Engine)
+------------------------+-------------------+
| OmniTrack Attendance   | Standard Frappe   |
| Synthesizer Log        | Attendance        |
+------------------------+-------------------+
```

---

## ⚙️ Core Engines

### 1. Split-Shift Synthesizer Engine (`synthesizer.py`)
- Evaluates raw `Employee Checkin` logs across configured day windows.
- Correlates punches before `midnight_cutoff_hour` (default `04:00:00`) with the previous calendar day's shift.
- Pairs IN/OUT punch sequences and calculates net working hours.
- Computes Late Entry and Early Exit relative to scheduled session boundaries.
- Generates/updates standard Frappe `Attendance` and audit logs.

### 2. Cross-Site Task Sync Engine (`sync.py`)
- Master-Satellite and Peer-to-Peer replication.
- Cryptographic HMAC-SHA256 signature verification over REST endpoints.
- Monotonic payload hashing (`SHA-256`) and conflict resolution strategies.

### 3. Plan Adherence (PAI) & Variance Engine (`api.py`)
- Real-time computation of Plan Adherence Index:
  $$\text{PAI} = \frac{\sum \text{Planned Hours}}{\sum \text{Total Executed Hours}} \times 100\%$$
- Dynamic variance categorization against project thresholds.
