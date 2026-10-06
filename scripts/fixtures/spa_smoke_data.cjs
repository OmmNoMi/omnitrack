/**
 * Synthetic API responses for the SPA smoke test. Shapes mirror
 * omnitrack.api.workstation.get_workstation_data / planner.get_planner_data /
 * timesheet.get_pending_team_approvals (key sets captured from a live site,
 * values are invented: no real people, projects or tasks).
 */
const iso = (d) => d.toISOString().slice(0, 10);

function build(now = new Date()) {
  const today = iso(now);
  const hh = (n) => String(n).padStart(2, '0') + ':00:00';
  const block = (i, o) => ({
    name: `PWB-SMOKE-${i}`, employee: 'smoke@example.com', associate_name: 'Smoke Tester', work_date: today,
    start_time: hh(9), end_time: hh(10), duration_hours: 1, actual_hours: 0, variance_hours: -1,
    project: 'PROJ-SMOKE', task: 'TASK-SMOKE-1', work_item: 'TASK-SMOKE-1', work_item_label: 'Smoke task',
    status: 'Planned', task_nature: 'Work', unplanned_reason: null, deliverable_notes: '', tasks: [],
    cryptographic_hash: 'x', billing_status: 'Billable', appsheet_id: null, cancel_reason: '', rescheduled_to: null,
    rescheduled_from: null, pairing_partner: null, paired_block: null, approval_status: 'Pending', sessions: [],
    output_metrics: [], pairing_partner_name: null, project_name: 'Smoke Project', task_subject: 'Smoke task',
    location: '', is_away: false, is_working: true, is_paid: true, ...o
  });
  const task = (i, o) => ({
    ref: `Task::TASK-SMOKE-${i}`, id: `TASK-SMOKE-${i}`, kind: 'Task', doctype: 'Task', docname: `TASK-SMOKE-${i}`,
    subject: `Smoke task ${i}`, project: 'PROJ-SMOKE', project_name: 'Smoke Project', status: 'Open', priority: 'High',
    due_date: today, estimate_hours: 4, booked_hours: 1, logged_hours: 0.5, deficit_hours: 3, is_overdue: false,
    is_due_today: true, days_overdue: 0, is_unplanned: false, is_underplanned: true, attention_level: 'warn',
    attention_badge: 'Underplanned', attention_reason: 'Needs more time', workflow_actions: [], ...o
  });
  const blocks = [
    block(1, { status: 'Completed', actual_hours: 1, variance_hours: 0, start_time: hh(7), end_time: hh(8), approval_status: 'Approved',
      deliverable_notes: 'Shipped it', sessions: [{ session_date: today, from_time: hh(7), to_time: hh(8), hours: 1, notes: 'Done', logged_via: 'Stopwatch' }] }),
    block(2, { start_time: hh(11), end_time: hh(12) }),
    block(3, { start_time: hh(15), end_time: hh(16), status: 'Cancelled', cancel_reason: 'Rescheduled' }),
    block(4, { work_item: null, task: null, task_subject: null, work_item_label: 'Break', task_nature: 'Break', is_working: false })
  ];
  const tasks = [task(1, {}), task(2, { is_overdue: true, days_overdue: 3, attention_level: 'critical', attention_badge: 'Overdue' })];
  const day = (n) => iso(new Date(now.getTime() + n * 864e5));
  const totals = { planned_hours: 3, actual_hours: 1, non_working_hours: 1, variance_hours: -2, adherence_pct: 33, block_count: 4, away_count: 0 };
  return {
    workstation: {
      current_user: 'smoke@example.com', current_user_fullname: 'Smoke Tester', is_client: false, client_project: null,
      work_blocks: blocks, projects: [{ name: 'PROJ-SMOKE', project_name: 'Smoke Project' }], tasks,
      assigned_tasks: tasks, attention_tasks: tasks,
      team_members: [{ name: 'smoke@example.com', full_name: 'Smoke Tester', role: 'Tester' }, { name: 'other@example.com', full_name: 'Other Person', role: 'Team Member' }],
      paci: { ratio: 66, planned_hours: 2, unplanned_hours: 1, total_hours: 3 },
      kpis: {
        employee: 'smoke@example.com',
        today: { date: today, target_hours: 8, planned_hours: 3, actual_hours: 1, non_working_hours: 1, variance_hours: -2, away_count: 0, block_count: 4, completed_count: 1, todo_completed_pct: 25 },
        week: { start: day(-3), end: day(3), target_hours: 40, planned_hours: 15, actual_hours: 6, non_working_hours: 2, variance_hours: -9, adherence_pct: 40, away_count: 0, block_count: 10 },
        month: { month: today.slice(0, 7), target_hours: 160, capacity_hours: 160, planned_hours: 60, actual_hours: 24, non_working_hours: 8, capacity_pct: 15, away_count: 0, block_count: 40 }
      },
      heatmap: { user: 'smoke@example.com', days: 7, matrix: [], current_streak: 2, total_hours: 6, average_daily_hours: 1 },
      synthesizer_logs: [], today_date: today, active_session: null, is_manager: true
    },
    planner: {
      user: 'smoke@example.com', is_manager: true, week_start: day(-3), week_end: day(3),
      days: [-3, -2, -1, 0, 1, 2, 3].map(day), blocks, assigned_tasks: tasks, attention_tasks: tasks, totals,
      past_block_lock_grace_hours: 24, timesheet_modification_horizon_hours: 48, allow_submitted_timesheet_amendment: 0
    },
    approvals: [block(1, { status: 'Completed', actual_hours: 1, approval_status: 'Pending' })]
  };
}
module.exports = { build };
