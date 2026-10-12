# Sinks and Safe Forms

Where request data becomes dangerous. When a source reaches one of these
without the safe form, it is a candidate finding (confirm per
`rules/rpt-evidence.md`).

## SQL (CWE-89)

| Stack | Dangerous | Safe |
|---|---|---|
| node-postgres / mysql2 | `query(\`... ${x}\`)`, `query('...' + x)` | `query('... $1', [x])` / `query('... ?', [x])` |
| Sequelize | `sequelize.query(str)` with interpolation, `literal(x)`, `where: sequelize.literal(...)` | `replacements` / `bind`, model finders with plain values |
| Knex | `raw(\`${x}\`)`, `whereRaw('a = ' + x)` | `raw('?', [x])`, `where('a', x)` |
| Prisma | `$queryRawUnsafe`, `$executeRawUnsafe`, `Prisma.raw(x)` | `$queryRaw` tagged template, model API |
| TypeORM | `query(str)`, `.where(\`a = ${x}\`)` | `.where('a = :x', { x })` |
| Python DB-API | `execute(f"...{x}")`, `execute("..." % x)`, `.format` | `execute("... %s", (x,))` |
| Django | `raw()`, `extra()`, `RawSQL` with interpolation | ORM filters, `raw(sql, params)` |
| SQLAlchemy | `text(f"...")`, `execute(f"...")` | `text("... :x")` with params |
| Java / JDBC | `Statement.execute(str + x)`, JPQL string concat | `PreparedStatement`, named parameters |
| PHP | `$pdo->query("...$x")`, `DB::raw`, `whereRaw` concat | prepared statements, bindings |
| Go | `db.Query(fmt.Sprintf(...))` | `db.Query("... $1", x)` |

Identifiers (`ORDER BY`, column, table names) cannot be bound: require an
allowlist.

## NoSQL (CWE-943)

Mongo/Mongoose: request objects in filters (`find({ email: req.body.email })`
when body is JSON → `{ "$ne": null }`), `$where`, `$regex` from input,
`mapReduce`/`$function` with strings. Safe: cast to string
(`String(req.body.email)`), schema validation that rejects objects,
`mongo-sanitize`, `sanitizeFilter: true`.

## OS command (CWE-78)

`child_process.exec/execSync`, `spawn(..., { shell: true })`, `os.system`,
`os.popen`, `subprocess.*(shell=True)`, `Runtime.getRuntime().exec(String)`,
PHP `exec/system/shell_exec/passthru/backticks`, Ruby backticks/`system(str)`.
Safe: argument arrays without a shell (`execFile`, `spawn(cmd, [args])`,
`subprocess.run([..])`) plus an allowlist for values used as flags.

## Code, template and deserialization (CWE-94, CWE-1336, CWE-502)

`eval`, `new Function`, `vm.run*`, `setTimeout(string)`; Python `eval/exec`,
`pickle.loads`, `yaml.load` (non-safe loader), `marshal`; `render_template_string(user)`,
Jinja `Environment(...).from_string(user)`, `ejs.render(user)`,
`Handlebars.compile(user)`; Java `ObjectInputStream.readObject`,
`XMLDecoder`; PHP `unserialize`; Ruby `Marshal.load`, `YAML.load`;
.NET `BinaryFormatter`.

## Filesystem (CWE-22, CWE-434)

`fs.readFile/createReadStream/writeFile/unlink/rename`, `res.sendFile`,
`res.download`, `path.join(base, input)`; Python `open`, `send_file`,
`send_from_directory` (safe-ish, still check), `os.path.join`,
`shutil`, `zipfile.extractall`/`tarfile.extractall` (zip slip); Java
`new File(base, input)`, `Paths.get`; PHP `include/require` with input
(LFI/RFI), `file_get_contents`, `move_uploaded_file`.
Safe: look up by server ID; `resolve` then check `startsWith(base + sep)`;
server-generated names; storage outside web root.

## Outbound requests (CWE-918, CWE-611)

`fetch`, `axios`, `got`, `node-fetch`, `http(s).get/request`, `undici`;
`requests`, `httpx`, `urllib`, `aiohttp`; `HttpClient`, `RestTemplate`,
`WebClient`, `OkHttp`; `file_get_contents(url)`, `curl_exec`; Puppeteer/
Playwright `page.goto`; PDF/image converters given URLs; XML parsers with
external entities (`libxml` `NOENT`, `DocumentBuilderFactory` defaults,
`lxml` `resolve_entities=True`).

## Response and browser (CWE-79, CWE-601, CWE-113)

HTML built from input (`res.send('<p>' + x)`), `dangerouslySetInnerHTML`
with server data, `| safe` / `{!! !!}` / `raw` in templates; user files
served inline; `res.redirect(req.query.next)` / `redirect(request.args['url'])`
(open redirect); input in `res.setHeader` (header injection).

## Model writes and money (CWE-915, CWE-362, CWE-840)

`Model.create(req.body)`, `Object.assign(model, req.body)`, `update(req.body)`,
`**request.json`, `fields='__all__'`, `permit!`, `$guarded = []`;
balance/stock read-modify-write outside a transaction or without an atomic
conditional update; payment provider calls (`stripe.refunds.create`,
`charges.create`, `transfers.create`) with amounts from the request.

## Auth primitives (CWE-287, CWE-347, CWE-798, CWE-916)

`jwt.decode` used for auth, `jwt.verify` without `algorithms`, secrets with
literal fallbacks, `md5`/`sha1`/plain `sha256` for passwords, `==` on tokens
(use constant-time compare), `Math.random()`/`random.random()` for tokens.
