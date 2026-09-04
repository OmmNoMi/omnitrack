frappe.ui.form.on('Planned Work Block', {
	refresh: function(frm) {
		if (frm.doc.status === 'Completed' && !frm.doc.timesheet) {
			frm.add_custom_button(__('Generate Timesheet'), function() {
				frappe.call({
					method: 'omnitrack.api.create_timesheet_from_work_block',
					args: { block_name: frm.doc.name },
					callback: function(r) {
						if (r.message) {
							frappe.msgprint(__('Timesheet Draft created: ' + r.message));
							frm.reload_doc();
						}
					}
				});
			}, __('Actions'));
		}
	},
	start_time: function(frm) {
		frm.trigger('calculate_duration');
	},
	end_time: function(frm) {
		frm.trigger('calculate_duration');
	},
	calculate_duration: function(frm) {
		if (frm.doc.start_time && frm.doc.end_time) {
			let t1 = frm.doc.start_time.split(':');
			let t2 = frm.doc.end_time.split(':');
			let h1 = parseFloat(t1[0]) + parseFloat(t1[1])/60;
			let h2 = parseFloat(t2[0]) + parseFloat(t2[1])/60;
			let diff = h2 - h1;
			if (diff < 0) diff += 24;
			frm.set_value('duration_hours', Math.round(diff * 100) / 100);
		}
	}
});
