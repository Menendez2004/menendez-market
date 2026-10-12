---
title: Server-side request forgery (SSRF)
impact: HIGH
tags:
  - security
  - ssrf
  - owasp-api7
---

## Rule

Find every outbound request whose URL, host, port or path is influenced by
the request: webhook registration, "import from URL", image/link previews,
PDF renderers, OAuth/OpenID discovery URLs, proxy endpoints, XML parsers
with external entities.

Confirmed when a request value reaches `fetch`, `axios`, `got`, `http.get`,
`requests.get`, `httpx`, `urllib`, `HttpClient`, `RestTemplate`,
`file_get_contents`, `curl_exec`, a headless browser `goto`, or an XML parser
with entities enabled, without:

- an allowlist of hosts (or scheme + host),
- resolving the hostname and rejecting private, loopback, link-local and
  metadata addresses (`169.254.169.254`, `fd00::/8`, `127.0.0.0/8`,
  `10/8`, `172.16/12`, `192.168/16`) **after** DNS resolution and on every
  redirect,
- disabling redirects or re-checking each hop.

A blocklist of strings like `localhost` is not a neutralizer
(`127.1`, `[::1]`, `0x7f000001`, DNS rebinding).

**Incorrect:**

```js
// routes/integrations.js:20
const r = await axios.get(req.body.url);
res.json(r.data);
```

- Error: `{"url":"http://169.254.169.254/latest/meta-data/iam/security-credentials/"}`
  returns cloud credentials.

**Correct:** allowlist the integration's hosts; if arbitrary URLs are a
feature, resolve and reject private ranges, disable redirects, and never
return the raw response body.

**Why it matters:** SSRF reaches internal services and cloud metadata that
are not exposed to the internet (OWASP API7:2023, CWE-918, CWE-611 for XXE).
