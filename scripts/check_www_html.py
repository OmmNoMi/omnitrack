#!/usr/bin/env python3
"""Structural guard for the in-DOM Vue templates under omnitrack/www.

These templates are parsed by the BROWSER, not by Vue's SFC compiler, so they
must be valid HTML. Two mistakes that an SFC tolerates collapse the whole page
here, silently, leaving raw {{ mustaches }} on screen:

  * self-closing a non-void element (`<f-dropdown … />`) — the browser keeps it
    open and it swallows the rest of the document;
  * nesting a control in a control (`<button>` inside `<button>`) — the parser
    closes the outer one early and every following `</div>` then lands on the
    wrong element, walking the close up through <main> and #app.

Both show up as structural parse errors from a spec-compliant parser, so parse
with html5lib and fail on exactly those. Run before shipping any www/*.html
edit: `python3 scripts/check_www_html.py`.
"""
import sys
from pathlib import Path

import html5lib

# Errors that mean the tree came out differently than the source reads.
STRUCTURAL = {
    "unexpected-end-tag",
    "end-tag-too-early",
    "end-tag-too-early-named",
    "unexpected-start-tag-implies-end-tag",
    "expected-one-end-tag-but-got-another",
    "unexpected-end-tag-treated-as",
    "eof-in-tag",
    "unexpected-end-tag-before-html",
}
# Vue expressions legitimately contain `a < b`, and Google Fonts URLs contain
# bare `&family=`; those are tokenizer noise, not structure.
IGNORED = {"expected-tag-name", "expected-named-entity", "unexpected-char-after-body"}


def check(path):
    parser = html5lib.HTMLParser(strict=False)
    parser.parse(path.read_text(encoding="utf8"))
    out = []
    for (line, col), code, data in parser.errors:
        if code in IGNORED or code not in STRUCTURAL:
            continue
        out.append(f"line {line}, col {col}: {code} {data or ''}".rstrip())
    return out


def main():
    root = Path(__file__).resolve().parent.parent / "omnitrack" / "www"
    failed = False
    for path in sorted(root.glob("*.html")):
        errors = check(path)
        if errors:
            failed = True
            print(f"\n{path}:")
            for e in errors:
                print(f"  {e}")
    if failed:
        print("\nFAIL: the browser will not build the tree these templates describe.")
        return 1
    print("OK: www templates parse to the tree they describe.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
