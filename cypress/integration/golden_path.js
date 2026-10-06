// Golden path: the workstation boots on a real site, a day can be planned,
// worked and approved. Uncaught exceptions fail the test (Cypress default),
// which is the safety net the jsdom smoke test cannot give on a real bundle.
const today = () => new Date().toISOString().slice(0, 10);

describe("OmniTrack golden path", () => {
	before(() => {
		cy.login();
	});

	it("boots and every tab renders", () => {
		cy.visit("/omnitrack");
		cy.get(".omnitrack-view-coordinator", { timeout: 30000 }).invoke("text").its("length").should("be.gt", 40);
		for (const tab of ["planner", "timesheets", "attendance", "dashboard"]) {
			cy.window().then((w) => {
				w.location.hash = `#/${tab}`;
			});
			cy.get(".omnitrack-view-coordinator").invoke("text").its("length").should("be.gt", 40);
		}
		// An unregistered component renders as an inert custom element, silently.
		cy.get("#app *").then(($els) => {
			const bad = [...$els].map((e) => e.tagName.toLowerCase()).filter((t) => t.includes("-") && t !== "svg-icon" && !customElements.get(t));
			expect(bad, "unresolved components").to.deep.equal([]);
		});
	});

	it("books a block, logs a session, and approves it", () => {
		const label = `Cypress golden path ${Date.now()}`;
		cy.call("omnitrack.api.planner.book_work_block", {
			work_date: today(),
			start_time: "23:00:00",
			end_time: "23:30:00",
			work_item_label: label,
		}).then((r) => {
			expect(r.message, "booked block").to.exist;
		});

		cy.visit("/omnitrack#/planner");
		cy.contains(label, { timeout: 30000 }).should("exist");

		cy.call("omnitrack.api.stopwatch.quick_timer_punch", {
			action: "stop",
			duration_seconds: 1800,
			deliverable_notes: `${label} (logged)`,
		}).then((r) => {
			expect(r.message, "completed session").to.exist;
		});

		cy.call("omnitrack.api.timesheet.approve_work_blocks", { work_date: today(), comments: "cypress" }).then((r) => {
			expect(r.message, "approval response").to.exist;
		});
	});
});
