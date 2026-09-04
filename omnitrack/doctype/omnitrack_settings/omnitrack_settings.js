frappe.ui.form.on('OmniTrack Settings', {
	refresh: function(frm) {
		frm.add_custom_button(__('Regenerate VAPID Keys'), function() {
			frappe.call({
				doc: frm.doc,
				method: 'generate_vapid_keys',
				callback: function(r) {
					if (r.message) {
						frappe.msgprint(__('VAPID Keys regenerated successfully'));
						frm.reload_doc();
					}
				}
			});
		}, __('Security'));
	}
});
