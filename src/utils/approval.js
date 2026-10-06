// Where a planned block's logged time stands in review. One wording for every screen.
// A Flag's reason is kept in approval_notes; the block has no other field for it.
// `short` is for a chip that sits beside the reason; `label` stands alone.
export function approvalState(b) {
  if (!b) return null;
  if (b.approval_status === 'Approved') return { tone: 'approved', short: 'Approved', label: 'Approved' };
  if (b.approval_status === 'Flagged') return { tone: 'flagged', short: 'Flagged', label: 'Flagged: ' + (b.approval_notes || 'needs clarifying') };
  if (Number(b.actual_hours) > 0) return { tone: 'pending', short: 'Awaiting approval', label: 'Awaiting approval' };
  return null;
}
