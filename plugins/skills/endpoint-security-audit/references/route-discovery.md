# Route Discovery

How to turn route definitions into a complete route map: the full path a
client calls, the handler, and the **effective middleware chain in order**.
Always open and read the files; `scripts/list_routes.py` only finds
candidates.

## Generic search recipe

```bash
# 1. Candidate routes, mounts and prefixes
python3 <skill-dir>/scripts/list_routes.py .            # add --json for machine use

# 2. App bootstrap: global prefix, global middleware/guards, error handler
grep -rnE --exclude-dir=node_modules --exclude-dir=.git \
  "createServer|express\(\)|Fastify\(|NestFactory|FastAPI\(|Flask\(|setGlobalPrefix|APP_GUARD|useGlobalGuards|MIDDLEWARE\s*=|app\.use\(|UseAuthentication|SecurityFilterChain|before_action|Kernel\.php" .

# 3. Auth primitives: what "authenticated" means here
grep -rnE --exclude-dir=node_modules --exclude-dir=.git \
  "jwt\.(verify|decode|sign)|passport\.|getServerSession|Depends\(get_current|login_required|@PreAuthorize|\[Authorize|authenticate_user!|auth:sanctum|requireAuth|isAuthenticated|@Public\(|AllowAnonymous|permit_all|skip_before_action" .

# 4. Specs and gateways that may add or hide routes
find . -path ./node_modules -prune -o \( -name 'openapi*.*' -o -name 'swagger*.*' -o -name 'serverless.y*ml' -o -name 'nginx*.conf' -o -name 'kong*.y*ml' -o -name 'template.y*ml' \) -print
```

If the framework can list its own routes without network or production
credentials, use it as a cross-check: `flask routes`, `rails routes`,
`php artisan route:list`, `python manage.py show_urls`
(django-extensions). Ask before starting anything.

## Per framework

| Framework | Full path = | Middleware / auth chain | Pitfalls |
|---|---|---|---|
| **Express / Koa / Hono** | every `app.use('/prefix', router)` up the tree + `router.get('/x')` | `app.use(fn)` and `router.use(fn)` apply only to routes registered **after** them; per-route middleware args run left to right | a route registered before `router.use(auth)` is public; routers mounted twice; `app.all('*')` catch-alls; `express.static` exposing folders |
| **Fastify** | `register(plugin, { prefix })` + route `url` | `onRequest`/`preHandler` hooks are encapsulated per plugin: a hook in a sibling plugin does not apply | routes in a plugin registered without the auth plugin's scope; `schema` validates only what it declares |
| **NestJS** | `setGlobalPrefix` + versioning + `@Controller('x')` + `@Get('y')` | global guards (`APP_GUARD`, `useGlobalGuards`) → controller `@UseGuards` → method `@UseGuards`; `@Public()`-style metadata opts out | `ValidationPipe` without `whitelist` passes extra fields; guards that `return true` on missing metadata |
| **Next.js** | `app/**/route.ts` folder path (`[id]` = param, `(group)` ignored); `pages/api/**` | `middleware.ts` with its `matcher`; auth helpers called inside each handler | matcher that skips `/api`; Server Actions are endpoints too (`'use server'` functions) |
| **FastAPI** | `include_router(prefix=)` + `APIRouter(prefix=)` + decorator path | `dependencies=[Depends(...)]` on app, router, or route; parameters with `Depends(get_current_user)` | a route that forgets the dependency; `response_model` missing → full ORM object returned |
| **Flask** | `register_blueprint(url_prefix=)` + `@bp.route` | `before_request` on app or blueprint, decorators like `@login_required` (order: decorator must be below `@route`) | decorator order inverted; `methods=` missing a method you thought was blocked |
| **Django / DRF** | `ROOT_URLCONF` → `include()` chain → `path()`; DRF routers generate list/detail/actions | `MIDDLEWARE` list; `DEFAULT_PERMISSION_CLASSES` vs. per-view `permission_classes`; `get_queryset` scoping | `permission_classes = []` or `AllowAny`; `get_queryset` returning `Model.objects.all()` (BOLA); `@csrf_exempt` |
| **Rails** | `config/routes.rb` (`namespace`, `scope`, `resources` → 7 actions) | `before_action` in controller and ancestors; `skip_before_action` | `skip_before_action :authenticate_user!` too broad; `params.permit!` |
| **Laravel** | `routes/api.php` (auto `/api`), `Route::prefix/group` | `middleware('auth:sanctum')` on group or route; policies / `authorize()` | routes outside the auth group; `$guarded = []` |
| **Spring Boot** | class `@RequestMapping` + method mapping; `server.servlet.context-path` | `SecurityFilterChain` matchers (first match wins) + `@PreAuthorize` | `permitAll()` matcher too broad (`/api/**`); method security not enabled |
| **ASP.NET Core** | `[Route]` on controller + `[HttpX]`; minimal API `MapGroup` | `UseAuthentication/UseAuthorization` order; `[Authorize]`, `[AllowAnonymous]`, fallback policy | `[AllowAnonymous]` on a controller overrides method `[Authorize]` |
| **Go (net/http, chi, gin, echo, fiber)** | `Group`/`Route` prefixes + method path | middleware passed to `Use` on the group, or wrapped handlers | handlers registered on the root router instead of the authed group |
| **GraphQL / tRPC** | each resolver / procedure is an endpoint | context auth + per-resolver checks; `protectedProcedure` | field resolvers returning other users' objects; introspection on in prod |

## Effective chain example (Express)

```js
// app.js
app.use(helmet());
app.use('/api', publicRouter);          // routes in publicRouter: no auth
app.use('/api', requireAuth, apiRouter); // everything in apiRouter: auth

// routes/api.js
router.get('/orders/:id', loadOrder, show);   // chain: helmet → requireAuth → loadOrder → show
router.use(requireAdmin);
router.post('/admin/refund', refund);        // chain: helmet → requireAuth → requireAdmin → refund
```

Route map row: `GET /api/orders/:id | routes/api.js:4 → controllers/orders.js:10 | auth: requireAuth | authz: none found | ...`
