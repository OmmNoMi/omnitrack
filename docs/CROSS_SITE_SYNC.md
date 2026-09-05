# 🔄 Enterprise Cross-Site Replication Engine

## 1. Architecture & Topologies
OmniTrack supports flexible multi-instance topologies for enterprises operating multiple Frappe instances across branches and subsidiaries:

1. **Master to Satellite**: Central HQ instance pushes policies and aggregates timesheets from satellite branches.
2. **Satellite to Master**: Branch instances stream work blocks and completed tasks upstream.
3. **Peer-to-Peer**: Decentralized instances synchronize shared project deliverable tasks.

---

## 2. Security & Signature Protocol

### HMAC-SHA256 Payload Verification
Every REST synchronization request carries an `X-OmniTrack-Signature` header computed as:
$$\text{Signature} = \text{HMAC-SHA256}(K_{\text{secret}}, \mathcal{P}_{\text{JSON}})$$

Where $K_{\text{secret}}$ is the shared secret stored in `OmniTrack Remote Connection` and $\mathcal{P}_{\text{JSON}}$ is the canonical sorted JSON string payload.

---

## 3. Conflict Resolution Policies
When both instances modify the same entity, the configured `conflict_resolution_strategy` decides precedence:
- **Latest Timestamp (Default)**: Entity with the highest ISO 8601 modified timestamp wins.
- **Source Wins**: Incoming payload overwrites local modifications.
- **Target Wins**: Local target version preserved; conflict logged in `OmniTrack Task Sync`.
- **Manual Review**: Task marked in `Conflict` state for manager intervention.
