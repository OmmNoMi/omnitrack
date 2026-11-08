# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""Plain text from the task form, stored in a Task's HTML description.

Pure (no frappe import), so its tests load it by path.
"""

import html
import re

# Tags plain text can stand for. Anything else (links, lists, images, tables, bold) is
# formatting the form's plain box would throw away.
_PLAIN_TAGS = {"p", "br", "div", "span"}
_TAG = re.compile(r"</?\s*([a-zA-Z][a-zA-Z0-9]*)")


def plain_to_html(text):
	"""Escapes the text and keeps its lines: a blank line starts a paragraph, a newline is a <br>."""
	text = (text or "").replace("\r\n", "\n").strip()
	if not text:
		return ""
	paras = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
	return "".join("<p>" + html.escape(p.strip()).replace("\n", "<br>") + "</p>" for p in paras)


def is_rich(value):
	"""True when the stored description has formatting beyond paragraphs and line breaks."""
	return any(tag.lower() not in _PLAIN_TAGS for tag in _TAG.findall(value or ""))
