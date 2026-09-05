# ⏱️ Split-Shift & Midnight Spanning Attendance Engine

## 1. Problem Definition
Traditional attendance systems assume single, contiguous working windows. In modern hospitality, retail, customer support, and software operations, employees frequently work discontinuous sessions (e.g., Morning 09:00–13:00 and Night 19:00–02:00).

When a shift spans past midnight, naive check-in systems record the post-midnight OUT punch on the new calendar day, causing false "Absent" or "Late Entry" deductions for the subsequent day.

---

## 2. Mathematical Model & Midnight Cutoff Logic

### The Midnight Cutoff Window
Let $D$ be the target attendance date and $T_{\text{cutoff}}$ be the configured `midnight_cutoff_hour` (default `04:00:00`).

The synthesis analysis window $\mathcal{W}(D)$ is defined as:
$$\mathcal{W}(D) = [D\text{ 00:00:00}, (D+1)\text{ }T_{\text{cutoff}}]$$

Any check-in punch timestamp $t$ occurring in $[(D+1)\text{ 00:00:00}, (D+1)\text{ }T_{\text{cutoff}}]$ is correlated with day $D$'s shift session.

---

## 3. Working Hours Calculation
Given $n$ paired check-in intervals $(\text{IN}_i, \text{OUT}_i)$:
$$\text{Total Working Hours} = \sum_{i=1}^{n} \frac{\text{OUT}_i - \text{IN}_i}{3600}$$

### Status Classification Rules
- $\text{Total Hours} \ge \text{min\_hours\_present}$ (default $6.0\text{h}$) $\rightarrow$ **Present**
- $\text{min\_hours\_half\_day} \le \text{Total Hours} < \text{min\_hours\_present}$ $\rightarrow$ **Half Day**
- $\text{Total Hours} < \text{min\_hours\_half\_day}$ (default $3.0\text{h}$) $\rightarrow$ **Absent**

---

## 4. Late Entry and Early Exit Rules
- **Late Entry**: Evaluated if $\text{First IN} > (\text{Session 1 Start} + \text{grace\_period\_mins})$.
- **Early Exit**: Evaluated if $\text{Last OUT} < (\text{Session } n \text{ End} - \text{grace\_period\_mins})$.
