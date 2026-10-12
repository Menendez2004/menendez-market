#!/usr/bin/env python3
"""List candidate HTTP route definitions in a codebase, with file:line.

Usage:
  python3 list_routes.py [<root>] [--json] [--include-tests]

Prints one row per route-looking line: method, path, framework, file:line and
the source line. It is a starting inventory, not proof: regex cannot follow
router mounts, global prefixes, decorators applied elsewhere or routes built at
runtime. Open each file, resolve the full path and confirm every row before
auditing it.

Standard library only, so it runs in any session without installing anything.
Exit code 0 always (an empty result is a finding to investigate, not an error).
"""

import json
import os
import re
import sys

SKIP_DIRS = {
    ".git", "node_modules", "vendor", "dist", "build", "out", ".next", ".nuxt",
    "coverage", "__pycache__", ".venv", "venv", "env", "target", ".gradle",
    ".idea", ".vscode", "bower_components", ".turbo", ".cache", "site-packages",
}
TEST_HINTS = re.compile(r"(^|/)(tests?|__tests__|spec|specs|e2e|fixtures?|mocks?)(/|$)|\.(test|spec)\.\w+$")
EXTS = {".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".jsx", ".tsx", ".py",
        ".rb", ".go", ".java", ".kt", ".php", ".cs"}
MAX_BYTES = 1_500_000

Q = r"""['"`]"""
PATTERNS = [
    # Express / Koa / Hono / Fastify shorthand / Elysia: app.get('/x', ...), router.post("/x"
    ("express-like", {".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".jsx", ".tsx"},
     re.compile(r"\b[\w$]+\s*\.\s*(get|post|put|patch|delete|del|all|options|head)\s*\(\s*" + Q + r"([^'\"`]*)" + Q, re.I)),
    # Express route chains: router.route('/x').get(...)
    ("express-route", {".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"},
     re.compile(r"\.\s*route\s*\(\s*" + Q + r"([^'\"`]*)" + Q + r"\s*\)")),
    # Router mounts: app.use('/api', router) — prefixes to prepend
    ("mount", {".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"},
     re.compile(r"\b[\w$]+\s*\.\s*(use|register)\s*\(\s*" + Q + r"(/[^'\"`]*)" + Q)),
    # Fastify full form: fastify.route({ method: 'GET', url: '/x' })
    ("fastify-route", {".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"},
     re.compile(r"\burl\s*:\s*" + Q + r"(/[^'\"`]*)" + Q)),
    # NestJS: @Controller('x') and @Get(':id')
    ("nest-controller", {".ts", ".js"},
     re.compile(r"@Controller\s*\(\s*(?:" + Q + r"([^'\"`]*)" + Q + r"|\{[^)]*path\s*:\s*" + Q + r"([^'\"`]*)" + Q + r")?")),
    ("nest", {".ts", ".js"},
     re.compile(r"@(Get|Post|Put|Patch|Delete|All|Options|Head)\s*\(\s*(?:" + Q + r"([^'\"`]*)" + Q + r")?\s*\)")),
    # Next.js App Router handlers: export async function GET(
    ("next-app", {".ts", ".js", ".tsx", ".jsx"},
     re.compile(r"export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b")),
    # Flask / Quart: @app.route('/x', methods=['POST'])
    ("flask", {".py"},
     re.compile(r"@[\w.]+\.route\s*\(\s*['\"]([^'\"]*)['\"](?:.*?methods\s*=\s*[\[(]([^\])]*)[\])])?")),
    # FastAPI / Flask 2 shorthand / Starlette: @router.post("/x")
    ("fastapi", {".py"},
     re.compile(r"@[\w.]+\.(get|post|put|patch|delete|options|head|api_route|websocket)\s*\(\s*['\"]([^'\"]*)['\"]")),
    ("fastapi-prefix", {".py"},
     re.compile(r"(?:APIRouter|include_router|register_blueprint|Blueprint)\s*\(.*?(?:prefix|url_prefix)\s*=\s*['\"]([^'\"]*)['\"]")),
    # Django: path('x/', view), re_path(r'^x$', view)
    ("django", {".py"},
     re.compile(r"\b(?:re_)?path\s*\(\s*r?['\"]([^'\"]*)['\"]\s*,\s*([\w.]+(?:\.as_view\(\))?|include\([^)]*\))")),
    ("drf-router", {".py"},
     re.compile(r"\.register\s*\(\s*r?['\"]([^'\"]*)['\"]\s*,\s*([\w.]+)")),
    # Rails: get 'x', to: ...; resources :orders
    ("rails", {".rb"},
     re.compile(r"^\s*(get|post|put|patch|delete|match)\s+['\"]([^'\"]+)['\"]")),
    ("rails-resources", {".rb"},
     re.compile(r"^\s*(resources?|namespace|scope)\s+[:'\"]?([\w/]+)")),
    # Laravel: Route::post('/x', ...)
    ("laravel", {".php"},
     re.compile(r"Route::(get|post|put|patch|delete|any|match|resource|apiResource|prefix)\s*\(\s*(?:\[[^\]]*\]\s*,\s*)?['\"]([^'\"]*)['\"]")),
    # Spring: @GetMapping("/x"), @RequestMapping(value = "/x", method = ...)
    ("spring", {".java", ".kt"},
     re.compile(r"@(Get|Post|Put|Patch|Delete|Request)Mapping\s*(?:\(\s*(?:(?:value|path)\s*=\s*)?\{?\s*\"([^\"]*)\")?")),
    # ASP.NET Core: [HttpPost("x")], [Route("api/x")], app.MapPost("/x"
    ("aspnet", {".cs"},
     re.compile(r"\[(Http(?:Get|Post|Put|Patch|Delete)|Route)\s*(?:\(\s*\"([^\"]*)\")?")),
    ("aspnet-minimal", {".cs"},
     re.compile(r"\.Map(Get|Post|Put|Patch|Delete|Group|Methods)\s*\(\s*\"([^\"]*)\"")),
    # Go: gin/echo/fiber r.GET("/x"), chi r.Get("/x"), net/http HandleFunc("/x"
    ("go", {".go"},
     re.compile(r"\.\s*(GET|POST|PUT|PATCH|DELETE|Get|Post|Put|Patch|Delete|HandleFunc|Handle|Group|Route|Any)\s*\(\s*\"([^\"]*)\"")),
]

# Handler files whose path is the route (file-based routing)
FILE_ROUTES = [
    ("next-app-file", re.compile(r"(^|/)app/(.*?)/route\.(t|j)sx?$")),
    ("next-pages-api", re.compile(r"(^|/)pages/(api/.*?)\.(t|j)sx?$")),
    ("sveltekit", re.compile(r"(^|/)routes/(.*?)/\+server\.(t|j)s$")),
    ("nuxt-server", re.compile(r"(^|/)server/(api/.*?)\.(t|j)s$")),
]

# Lines that look like routes but are not: HTTP clients, test calls, maps
NOISE = re.compile(r"\b(axios|fetch|http|https|request|supertest|agent|client|api|got|ky|superagent|"
                   r"cy|page|requests|session|httpx|self\.client|map|params|headers|query|cache|"
                   r"localStorage|sessionStorage|searchParams|formData|cookies|store|config|env|"
                   r"Map|Set|redis|db|collection|model|_\.)\s*\.\s*(get|post|put|patch|delete|all|head|options)\s*\(", re.I)


def norm_method(fw, m):
    if not m:
        return "ANY" if fw in {"django", "drf-router", "express-route", "nest-controller",
                               "fastapi-prefix", "mount", "rails-resources", "fastify-route"} else "GET"
    m = m.upper().replace("DEL", "DELETE") if m.upper() == "DEL" else m.upper()
    return {"REQUEST": "ANY", "ALL": "ANY", "HANDLEFUNC": "ANY", "HANDLE": "ANY",
            "API_ROUTE": "ANY", "MATCH": "ANY", "METHODS": "ANY", "ROUTE": "PREFIX",
            "GROUP": "PREFIX", "PREFIX": "PREFIX", "RESOURCE": "RESOURCE",
            "APIRESOURCE": "RESOURCE", "RESOURCES": "RESOURCE", "NAMESPACE": "PREFIX",
            "SCOPE": "PREFIX", "USE": "MOUNT", "REGISTER": "MOUNT",
            "HTTPGET": "GET", "HTTPPOST": "POST", "HTTPPUT": "PUT", "HTTPPATCH": "PATCH",
            "HTTPDELETE": "DELETE"}.get(m, m)


def scan_line(rel, ext, lineno, line):
    rows = []
    stripped = line.strip()
    if stripped.startswith(("//", "#", "*", "/*")) and not stripped.startswith(("#[", "#!")):
        if not (ext == ".py" and stripped.startswith("@")):
            return rows
    for fw, exts, rx in PATTERNS:
        if ext not in exts:
            continue
        for m in rx.finditer(line):
            if fw == "express-like" and NOISE.search(line):
                continue
            g = m.groups()
            if fw in {"express-route", "fastify-route", "fastapi-prefix"}:
                method, path = None, g[0]
            elif fw == "nest-controller":
                method, path = "PREFIX", g[0] or g[1] or ""
            elif fw == "next-app":
                method, path = g[0], "(file route)"
            elif fw == "flask":
                path = g[0]
                method = ",".join(x.strip(" '\"").upper() for x in (g[1] or "GET").split(",") if x.strip())
            elif fw in {"django", "drf-router"}:
                method, path = None, g[0]
            elif fw == "spring":
                method, path = g[0], g[1] or ""
            elif fw == "aspnet":
                method, path = ("PREFIX" if g[0] == "Route" else g[0]), g[1] or ""
            else:
                method, path = g[0], (g[1] if len(g) > 1 else "") or ""
            if fw == "express-like" and not (path.startswith("/") or path in {"", "*"}):
                continue
            if fw in {"express-like", "fastapi"} and path.startswith(("http://", "https://")):
                continue
            rows.append({
                "method": method if (method and "," in method) else norm_method(fw, method),
                "path": path,
                "framework": fw,
                "location": f"{rel}:{lineno}",
                "source": stripped[:160],
            })
    return rows


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    as_json = "--json" in argv
    include_tests = "--include-tests" in argv
    root = os.path.abspath(args[0] if args else ".")
    rows = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".") or d == ".well-known")
        for name in sorted(filenames):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            ext = os.path.splitext(name)[1].lower()
            if ext not in EXTS:
                continue
            if not include_tests and TEST_HINTS.search(rel):
                continue
            for fw, rx in FILE_ROUTES:
                fm = rx.search(rel)
                if fm:
                    rows.append({"method": "FILE", "path": "/" + fm.group(2), "framework": fw,
                                 "location": f"{rel}:1", "source": "(file-based route)"})
            try:
                if os.path.getsize(full) > MAX_BYTES:
                    continue
                with open(full, encoding="utf-8", errors="replace") as fh:
                    for i, line in enumerate(fh, 1):
                        rows.extend(scan_line(rel, ext, i, line))
            except OSError:
                continue

    if as_json:
        print(json.dumps({"root": root, "count": len(rows), "routes": rows}, indent=2))
        return 0
    if not rows:
        print(f"No route-looking lines found under {root}.")
        print("Check for routes registered at runtime, a gateway config, OpenAPI specs or an unsupported framework.")
        return 0
    print(f"# Route candidates under {root} ({len(rows)})\n")
    print("Verify each row: resolve mounts/prefixes (MOUNT, PREFIX rows) into full paths and drop false positives.\n")
    print("| Method | Path | Framework | Location | Source |")
    print("| --- | --- | --- | --- | --- |")
    for r in rows:
        src = r["source"].replace("|", "\\|")
        print(f"| {r['method']} | `{r['path']}` | {r['framework']} | {r['location']} | `{src}` |")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
