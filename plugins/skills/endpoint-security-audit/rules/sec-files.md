---
title: Path traversal, file upload and download
impact: CRITICAL
tags:
  - security
  - files
  - path-traversal
  - upload
---

## Rule

Any request value that becomes part of a filesystem path, and any route
that stores or serves files, must keep files inside a fixed base directory
and never let the client choose the stored name, location or type.

Check:

- **Traversal**: `path.join(BASE, req.params.name)`, `open(os.path.join(dir, name))`,
  `res.sendFile`, `send_file`, `File(...)`, `readFile`, `unlink`,
  archive extraction (zip slip) using a client-supplied name. `path.join`
  and `os.path.join` do not stop `../`; `os.path.join(base, "/etc/passwd")`
  even discards the base. Neutralized only by `resolve` + "starts with
  base + separator" check, or by looking the file up by an ID.
- **Upload storage**: files saved under the web root or a folder served
  statically (`express.static('uploads')`, `public/`); original filename
  reused on disk; no size limit; type checked only by extension or
  `Content-Type`; executable permission on the folder.
- **Download**: served without an ownership check (BOLA on files), without
  `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`
  for user content (stored XSS via HTML/SVG).
- **Path disclosure**: responses or errors that include the stored path
  (see `sec-exposure.md`).

**Incorrect:**

```js
// routes/files.js:11
router.get('/files/:name', requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, '../uploads', req.params.name)));
```

- Error: `GET /api/files/..%2f..%2f.env` reads any file the process can
  read; also no ownership check.

**Correct:**

```js
const meta = await File.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
if (!meta) return res.status(404).end();
const full = path.resolve(UPLOAD_DIR, meta.storedName);   // storedName = server UUID
if (!full.startsWith(UPLOAD_DIR + path.sep)) return res.status(404).end();
res.set('X-Content-Type-Options', 'nosniff').attachment(meta.originalName).sendFile(full);
```

**Why it matters:** Traversal reads secrets and source; unrestricted
uploads become web shells (CWE-22, CWE-434, CWE-73). The OWASP File Upload
Cheat Sheet is the reference for the full list of upload controls.
