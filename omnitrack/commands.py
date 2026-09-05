import click
import frappe
from omnitrack.importer import run_full_migration, verify_migration_prerequisites


@click.command("omnitrack-verify-migration")
@click.option("--site", default=None, help="Target Frappe site")
def verify_migration_cmd(site=None):
	"""Verify OmniTrack migration pre-requisites."""
	if site:
		frappe.init(site=site)
		frappe.connect()

	results = verify_migration_prerequisites()
	if results["status"] == "success":
		click.secho("✅ All OmniTrack migration prerequisites passed!", fg="green")
		for chk in results["checks"]:
			click.echo(f"  ✓ {chk}")
	else:
		click.secho("❌ Migration prerequisites failed:", fg="red")
		for err in results["errors"]:
			click.secho(f"  ✗ {err}", fg="red")


@click.command("omnitrack-import-historical")
@click.option("--site", default=None, help="Target Frappe site")
@click.option("--data-dir", default=None, help="Directory path containing AppSheet CSV exports (optional, defaults to Desk File Manager)")
@click.option("--dry-run", is_flag=True, help="Run migration in dry-run mode without committing to DB")
def import_historical_cmd(data_dir=None, site=None, dry_run=False):
	"""Import AppSheet historical Projects, Tasks, and TimeLogs into OmniTrack."""
	from omnitrack.importer import run_migration_from_site_files

	if site:
		frappe.init(site=site)
		frappe.connect()

	if data_dir:
		res = run_full_migration(data_directory=data_dir, dry_run=dry_run)
	else:
		res = run_migration_from_site_files(dry_run=dry_run)

	if res.get("status") == "success":
		click.secho(f"✨ Migration finished successfully in {res.get('elapsed_seconds', 0):.2f}s", fg="green")
	else:
		click.secho("❌ Migration failed.", fg="red")


commands = [
	verify_migration_cmd,
	import_historical_cmd
]
