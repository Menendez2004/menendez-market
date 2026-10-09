#!/usr/bin/env python3
"""Validate an API handoff Markdown file against the api-handoff template.

Usage: python3 validate_handoff.py <file.handoff.md> [<more files>...]

Exit code 0 when every file passes (warnings allowed), 1 otherwise.
Standard library only, so it runs in any session without installing anything.
"""

import json
import re
import sys

HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
BODY_METHODS = {"POST", "PUT", "PATCH"}
REQUIRED_FRONT = ["handoff", "title", "direction", "receiver", "status",
                  "revision", "created", "updated", "author", "source", "endpoints"]
REQUIRED_SOURCE = ["repo", "branch", "commit"]
DIRECTIONS = {"backend-to-frontend": "frontend", "frontend-to-backend": "backend"}
TOP_SECTIONS = ["Summary", "What the receiver must do", "Conventions",
                "Open questions", "Changelog"]
ENDPOINT_H3 = ["Purpose", "Request", "Responses", "Behavior and side effects",
               "Receiver notes", "Acceptance criteria"]
REQUEST_H4 = ["Path parameters", "Query parameters", "Headers", "Body"]
RESPONSE_H4 = ["Success", "Errors"]
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SECRET_PATTERNS = [
    (re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}"), "JWT"),
    (re.compile(r"\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{10,}"), "Stripe-style API key"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "AWS access key"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}"), "GitHub token"),
    (re.compile(r"\bxox[abpr]-[A-Za-z0-9-]{10,}"), "Slack token"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "private key"),
    (re.compile(r"Bearer\s+(?!<)[A-Za-z0-9._~+/-]{24,}"), "bearer token"),
]


# ---------------------------------------------------------------- parsing

def parse_scalar(raw):
    raw = raw.strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
        return raw[1:-1]
    if re.fullmatch(r"-?\d+", raw):
        return int(raw)
    return raw


def parse_front_matter(text):
    """Parse the small YAML subset the template uses (maps, lists of maps/scalars)."""
    try:
        import yaml  # type: ignore
        return yaml.safe_load(text) or {}
    except ImportError:
        pass
    root, key, item = {}, None, None
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        body = line.strip()
        if indent == 0:
            k, _, v = body.partition(":")
            key, item = k.strip(), None
            root[key] = parse_scalar(v) if v.strip() else None
        elif body.startswith("- "):
            if not isinstance(root.get(key), list):
                root[key] = []
            entry = body[2:]
            if re.match(r"^[\w.-]+:\s", entry + " ") and not entry.startswith("http"):
                k, _, v = entry.partition(":")
                item = {k.strip(): parse_scalar(v)}
                root[key].append(item)
            else:
                item = None
                root[key].append(parse_scalar(entry))
        else:
            k, _, v = body.partition(":")
            if item is not None and isinstance(root.get(key), list):
                item[k.strip()] = parse_scalar(v)
            else:
                if not isinstance(root.get(key), dict):
                    root[key] = {}
                root[key][k.strip()] = parse_scalar(v)
    return root


def strip_code(text):
    """Blank out fenced code blocks so headings inside them are ignored."""
    out, fence = [], None
    for line in text.splitlines():
        m = re.match(r"^\s*(`{3,}|~{3,})", line)
        if m:
            if fence is None:
                fence = m.group(1)
            elif line.strip().startswith(fence):
                fence = None
            out.append("")
            continue
        out.append("" if fence else line)
    return out


def split_sections(lines, level, start=0, end=None):
    """Return [(title, first_line, last_line)] for headings of exactly `level` hashes."""
    end = len(lines) if end is None else end
    marks = []
    prefix = "#" * level + " "
    for i in range(start, end):
        if lines[i].startswith(prefix):
            marks.append((lines[i][len(prefix):].strip(), i))
    result = []
    for n, (title, i) in enumerate(marks):
        stop = marks[n + 1][1] if n + 1 < len(marks) else end
        # a higher-level heading also ends the section
        for j in range(i + 1, stop):
            if re.match(r"^#{1,%d} " % (level - 1), lines[j]) if level > 1 else False:
                stop = j
                break
        result.append((title, i, stop))
    return result


def json_blocks(raw_lines, start, end):
    """Yield (line_no, text) for ```json fenced blocks inside [start, end)."""
    i = start
    while i < end:
        m = re.match(r"^\s*(`{3,})\s*json\s*$", raw_lines[i], re.IGNORECASE)
        if m:
            fence = m.group(1)
            body = []
            j = i + 1
            while j < end and not raw_lines[j].strip().startswith(fence):
                body.append(raw_lines[j])
                j += 1
            yield i + 1, "\n".join(body)
            i = j + 1
        else:
            i += 1


def table_rows(lines, start, end):
    """Return rows (list of cells) of the first Markdown table in [start, end)."""
    rows = []
    for i in range(start, end):
        line = lines[i].strip()
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            if all(re.fullmatch(r":?-{3,}:?", c) for c in cells if c):
                continue
            rows.append(cells)
        elif rows:
            break
    return rows


def json_paths(value, prefix=""):
    paths = set()
    if isinstance(value, dict):
        for k, v in value.items():
            p = f"{prefix}.{k}" if prefix else k
            paths.add(p)
            paths |= json_paths(v, p)
    elif isinstance(value, list):
        for v in value:
            paths |= json_paths(v, prefix + "[]")
        if prefix and not value:
            paths.add(prefix + "[]")
    return paths


def clean_field(cell):
    return cell.replace("`", "").strip()


# ---------------------------------------------------------------- checks

def validate(path):
    errors, warnings = [], []
    try:
        text = open(path, encoding="utf-8").read()
    except OSError as exc:
        return [f"cannot read file: {exc}"], []

    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not m:
        return ["missing YAML front matter (file must start with '---')"], []
    front = parse_front_matter(m.group(1))
    body_offset = text[: m.end()].count("\n")
    raw = text.splitlines()
    lines = strip_code(text)
    for i in range(body_offset):
        lines[i] = ""

    # front matter
    for k in REQUIRED_FRONT:
        if front.get(k) in (None, "", [], {}):
            errors.append(f"front matter: '{k}' is missing or empty")
    if front.get("handoff") not in (None, "api"):
        errors.append("front matter: 'handoff' must be 'api'")
    direction, receiver = front.get("direction"), front.get("receiver")
    if direction and direction not in DIRECTIONS:
        errors.append(f"front matter: direction '{direction}' must be one of {sorted(DIRECTIONS)}")
    elif direction and receiver != DIRECTIONS[direction]:
        errors.append(f"front matter: direction '{direction}' requires receiver '{DIRECTIONS[direction]}'")
    status = front.get("status")
    if status not in ("draft", "ready"):
        errors.append("front matter: status must be 'draft' or 'ready'")
    if not isinstance(front.get("revision"), int) or front.get("revision", 0) < 1:
        errors.append("front matter: revision must be an integer >= 1")
    for k in ("created", "updated"):
        if front.get(k) is not None and not DATE_RE.match(str(front[k])):
            errors.append(f"front matter: '{k}' must be YYYY-MM-DD")
    source = front.get("source") or {}
    if isinstance(source, dict):
        for k in REQUIRED_SOURCE:
            if not source.get(k):
                errors.append(f"front matter: source.{k} is missing")
    endpoints = front.get("endpoints") or []
    if not isinstance(endpoints, list):
        errors.append("front matter: endpoints must be a list")
        endpoints = []
    for n, ep in enumerate(endpoints, 1):
        if not isinstance(ep, dict):
            errors.append(f"front matter: endpoints[{n}] must be a map with id, method, path")
            continue
        for k in ("id", "method", "path", "change"):
            if not ep.get(k):
                errors.append(f"front matter: endpoints[{n}].{k} is missing")
        if ep.get("method") and str(ep["method"]).upper() not in HTTP_METHODS:
            errors.append(f"front matter: endpoints[{n}].method '{ep['method']}' is not an HTTP method")
        if ep.get("change") and ep["change"] not in ("new", "changed", "existing"):
            errors.append(f"front matter: endpoints[{n}].change must be new, changed or existing")
        if ep.get("path") and not str(ep["path"]).startswith("/"):
            errors.append(f"front matter: endpoints[{n}].path must start with '/'")

    # top-level sections
    h2 = split_sections(lines, 2, body_offset)
    titles = [t for t, _, _ in h2]
    for s in TOP_SECTIONS:
        if s not in titles:
            errors.append(f"missing section '## {s}'")

    # endpoint sections
    ep_sections = [(t, a, b) for t, a, b in h2 if t.startswith("Endpoint ")]
    if len(ep_sections) != len(endpoints):
        errors.append(f"front matter lists {len(endpoints)} endpoint(s) but the body has "
                      f"{len(ep_sections)} '## Endpoint N' section(s)")
    for n, (title, a, b) in enumerate(ep_sections, 1):
        tm = re.match(r"^Endpoint (\d+)\s+[—-]\s+([A-Z]+)\s+(\S+)\s*$", title)
        label = f"Endpoint {n}"
        if not tm:
            errors.append(f"'## {title}': heading must be '## Endpoint {n} — METHOD /path'")
            continue
        num, method, ep_path = int(tm.group(1)), tm.group(2), tm.group(3)
        if num != n:
            errors.append(f"'## {title}': expected number {n}")
        if n <= len(endpoints) and isinstance(endpoints[n - 1], dict):
            fm = endpoints[n - 1]
            if str(fm.get("method", "")).upper() != method or str(fm.get("path")) != ep_path:
                errors.append(f"{label}: heading '{method} {ep_path}' does not match front matter "
                              f"'{fm.get('method')} {fm.get('path')}'")
        h3 = {t: (s, e) for t, s, e in split_sections(lines, 3, a + 1, b)}
        for s in ENDPOINT_H3:
            if s not in h3:
                errors.append(f"{label}: missing '### {s}'")
        for parent, children in (("Request", REQUEST_H4), ("Responses", RESPONSE_H4)):
            if parent not in h3:
                continue
            s, e = h3[parent]
            h4 = {t: (x, y) for t, x, y in split_sections(lines, 4, s + 1, e)}
            for c in children:
                if c not in h4:
                    errors.append(f"{label}: missing '#### {c}' under '### {parent}'")
                    continue
                x, y = h4[c]
                content = "\n".join(raw[x + 1:y]).strip()
                if not content:
                    errors.append(f"{label}: '#### {c}' is empty (write 'None.' if it does not apply)")
            if parent == "Request" and "Body" in h4:
                check_body(label, method, raw, lines, *h4["Body"], errors, warnings)
            if parent == "Responses" and "Errors" in h4:
                x, y = h4["Errors"]
                rows = table_rows(lines, x + 1, y)
                if len(rows) < 2 and "none" not in "\n".join(raw[x + 1:y]).lower():
                    errors.append(f"{label}: '#### Errors' needs a table with at least one error row")
            if parent == "Responses" and "Success" in h4:
                x, y = h4["Success"]
                if not re.search(r"\b[1-3]\d\d\b", "\n".join(raw[x + 1:y])):
                    errors.append(f"{label}: '#### Success' must state the status code")
        if "Purpose" in h3:
            s, e = h3["Purpose"]
            if not "\n".join(raw[s + 1:e]).strip():
                errors.append(f"{label}: '### Purpose' is empty")
        if "Acceptance criteria" in h3:
            s, e = h3["Acceptance criteria"]
            acs = [l for l in raw[s + 1:e] if re.match(r"^\s*- \[[ xX]\] AC-\d+\.\d+", l)]
            if not acs:
                errors.append(f"{label}: needs at least one '- [ ] AC-{n}.1 ...' acceptance criterion")
            for l in acs:
                if not re.match(rf"^\s*- \[[ xX]\] AC-{n}\.\d+", l):
                    warnings.append(f"{label}: criterion '{l.strip()[:40]}' should be numbered AC-{n}.x")

    # every JSON block must parse
    for line_no, block in json_blocks(raw, body_offset, len(raw)):
        try:
            json.loads(block)
        except json.JSONDecodeError as exc:
            errors.append(f"line {line_no}: JSON example does not parse: {exc.msg} "
                          f"(line {exc.lineno} of the block)")

    # leftovers from the template
    body_text = "\n".join(raw[body_offset:])
    leftovers = re.findall(r"<(?:Feature name|Task|field|name|example|meaning|when|CODE|question)>", body_text)
    if leftovers:
        errors.append(f"unfilled template placeholders: {sorted(set(leftovers))}")
    if "<!--" in body_text:
        warnings.append("template HTML comments still present")

    # status ready means nothing is open
    if status == "ready":
        if re.search(r"\bTBD\b", text):
            errors.append("status is 'ready' but the file still contains TBD")
        oq = next(((a, b) for t, a, b in h2 if t == "Open questions"), None)
        if oq and any(re.match(r"^\s*[-*] ", l) for l in raw[oq[0] + 1:oq[1]]):
            errors.append("status is 'ready' but '## Open questions' lists items "
                          "(resolve them or set status: draft)")
    else:
        for tbd in re.findall(r"\bTBD\b(?!\s*\(Q\d+\))", body_text):
            warnings.append("a TBD does not reference an open question id, e.g. 'TBD (Q1)'")
            break

    # secrets
    for pattern, kind in SECRET_PATTERNS:
        for mm in pattern.finditer(text):
            line_no = text[: mm.start()].count("\n") + 1
            errors.append(f"line {line_no}: looks like a real {kind}; use a placeholder")

    return errors, warnings


def check_body(label, method, raw, lines, start, end, errors, warnings):
    content = "\n".join(raw[start + 1:end])
    no_body = re.search(r"\bno body\b", content, re.IGNORECASE)
    blocks = list(json_blocks(raw, start + 1, end))
    rows = table_rows(lines, start + 1, end)
    if no_body:
        if method in BODY_METHODS:
            warnings.append(f"{label}: {method} with 'No body.' — confirm that is intended")
        return
    if not rows or not blocks:
        errors.append(f"{label}: '#### Body' needs a field table and a ```json example "
                      f"(or 'No body.')")
        return
    header = [h.lower() for h in rows[0]]
    if not header or header[0] != "field" or "type" not in header or "required" not in header:
        errors.append(f"{label}: body table header must start with | Field | Type | Required |")
        return
    req_col = header.index("required")
    fields = {}
    for r in rows[1:]:
        if r and r[0]:
            fields[clean_field(r[0])] = r[req_col].lower() if req_col < len(r) else ""
    try:
        example = json.loads(blocks[0][1])
    except json.JSONDecodeError:
        return  # reported by the global JSON check
    paths = json_paths(example)
    for p in sorted(paths - set(fields)):
        errors.append(f"{label}: body example has '{p}' which is not in the field table")
    for f, req in fields.items():
        if req.startswith("yes") and f not in paths:
            errors.append(f"{label}: required body field '{f}' is missing from the JSON example")


def main(argv):
    if len(argv) < 2:
        print(__doc__.strip())
        return 2
    failed = False
    for path in argv[1:]:
        errors, warnings = validate(path)
        print(f"{path}: {'FAIL' if errors else 'PASS'} "
              f"({len(errors)} error(s), {len(warnings)} warning(s))")
        for e in errors:
            print(f"  ERROR   {e}")
        for w in warnings:
            print(f"  WARNING {w}")
        failed = failed or bool(errors)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
