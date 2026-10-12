---
title: "Injection: SQL, NoSQL, command, template, eval, deserialization"
impact: CRITICAL
tags:
  - security
  - injection
  - sqli
  - owasp-api8
---

## Rule

Any request-controlled value that reaches an interpreter must be passed as
data (parameters, argument arrays, escaped template variables), never
concatenated or interpolated into code. Trace every source to the sinks in
`references/sinks.md`.

Check:

- **SQL**: string concatenation or template literals in `query()`,
  `raw()`, `sequelize.query`, `knex.raw`, `$queryRawUnsafe`, `execute(f"...")`,
  `cursor.execute("..." % x)`, `.extra()`, `whereRaw`. Also identifiers
  (column/table names, `ORDER BY ${sort}`) — these cannot be parameterized
  and need an allowlist.
- **NoSQL**: request objects passed straight into Mongo filters
  (`User.find({ email: req.body.email })` where `email` can be
  `{"$ne": null}`), `$where`, `mapReduce` with user strings.
- **Command**: `exec`, `execSync`, `spawn(..., { shell: true })`,
  `os.system`, `subprocess(..., shell=True)`, backticks, `Runtime.exec`
  with a concatenated string.
- **Template / code**: `eval`, `new Function`, `vm.runInContext`,
  server-side template rendered from a user string (`render_template_string`,
  `ejs.render(userInput)`), unsafe deserialization (`pickle.loads`,
  `yaml.load` without SafeLoader, `node-serialize`, Java
  `ObjectInputStream`).
- **Other**: LDAP filters, XPath, regex built from user input (ReDoS),
  header injection (`\r\n` in values set on responses), open redirects
  (`res.redirect(req.query.next)`).

**Incorrect:**

```js
// services/search.js:8
db.query(`SELECT * FROM products WHERE name LIKE '%${q}%'`);
```

**Correct:**

```js
db.query('SELECT * FROM products WHERE name LIKE $1', [`%${q}%`]);
```

A parameterized query with the same shape elsewhere is **not** a finding —
do not flag safe uses of the same sink.

**Why it matters:** Injection gives an attacker the interpreter: dump or
alter the database, run commands on the server (CWE-89, CWE-943, CWE-78,
CWE-94, CWE-502; OWASP API8:2023 and Top 10 A03).
