import frappe
from frappe.model.document import Document

class OmniTrackRemoteConnection(Document):
	@frappe.whitelist()
	def test_connection(self):
		import requests
		try:
			url = f"{self.remote_url.rstrip('/')}/api/method/frappe.auth.get_logged_user"
			headers = {"Authorization": f"token {self.api_key}:{self.get_password('api_secret')}"}
			res = requests.get(url, headers=headers, timeout=5)
			if res.status_code == 200:
				user = res.json().get('message')
				return {"status": "success", "message": f"Connected successfully as {user}"}
			else:
				return {"status": "error", "message": f"HTTP {res.status_code}: {res.text}"}
		except Exception as e:
			return {"status": "error", "message": str(e)}
