frappe.ui.form.on('OmniTrack Remote Connection', {
	refresh: function(frm) {
		frm.add_custom_button(__('Test Connection'), function() {
			frappe.call({
				doc: frm.doc,
				method: 'test_connection',
				callback: function(r) {
					if (r.message && r.message.status === 'success') {
						frappe.msgprint({
							title: __('Success'),
							indicator: 'green',
							message: r.message.message
						});
					} else {
						frappe.msgprint({
							title: __('Connection Failed'),
							indicator: 'red',
							message: r.message ? r.message.message : __('Unknown error')
						});
					}
				}
			});
		}, __('Actions'));
	}
});
