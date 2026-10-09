# Contract Discovery

Where to find each part of an endpoint's contract, per framework. Always
search, then open and read; never assume a file layout.

## Generic search recipe

```bash
# 1. Route by path fragment (works for most frameworks)
grep -rnE "['\"]/?orders" --include='*.ts' --include='*.js' --include='*.py' --include='*.rb' \
  --include='*.go' --include='*.java' --include='*.kt' --include='*.php' --include='*.cs' \
  --exclude-dir=node_modules --exclude-dir=.git .

# 2. Global prefix / versioning / mount points
grep -rnE --exclude-dir=node_modules --exclude-dir=.git "setGlobalPrefix|enableVersioning|app\.use\(['\"]/|APIRouter\(prefix|include_router|path\(['\"]api|namespace :api|scope ['\"]/api|@RequestMapping|Route::prefix|MapGroup" .

# 3. Global error handling (the error envelope)
grep -rnE --exclude-dir=node_modules --exclude-dir=.git "ExceptionFilter|@Catch\(|exception_handler|errorHandler|rescue_from|@ControllerAdvice|render\(\$request, Throwable|UseExceptionHandler" .

# 4. Existing API docs/specs the code generates (cross-check, not source of truth)
find . -path ./node_modules -prune -o \( -name 'openapi*.json' -o -name 'openapi*.y*ml' -o -name 'swagger*.json' -o -name 'swagger*.y*ml' \) -print
```

If the app can list its routes, use it: `rails routes`, `php artisan
route:list`, `python manage.py show_urls` (django-extensions), the
FastAPI `/openapi.json` of a running dev server, `flask routes`. Ask
before starting a server.

## Per framework

| Framework | Route | Body / query validation | Response shape | Auth | Default success status |
|---|---|---|---|---|---|
| **NestJS** | `@Controller('x')` + `@Get/@Post(...)`; prefix in `main.ts` `setGlobalPrefix`, versioning `enableVersioning` | DTO class with `class-validator` decorators; `ValidationPipe` options (`whitelist`, `forbidNonWhitelisted`, `transform`) change behavior | return type / `@ApiResponse` / interceptors (`ClassSerializerInterceptor`, `@Exclude`) | `@UseGuards`, `@Roles`, global guards in `app.module.ts` | `POST` 201, else 200; `@HttpCode` overrides |
| **Express / Koa / Fastify** | `router.get(...)`, `app.use('/prefix', router)` — follow every mount | Zod / Joi / Yup / celebrate / express-validator middleware; Fastify `schema:` | what `res.json` / `reply.send` gets | middleware before the handler | whatever `res.status()` sets, else 200 |
| **Next.js** | `app/api/**/route.ts` exports `GET/POST`; `pages/api/**` | Zod in the handler, or none (then document what the code reads) | `NextResponse.json(body, { status })` | `middleware.ts`, session helpers | 200 unless set |
| **tRPC** | router key path (`orders.create`) — the "endpoint" is the procedure | `.input(zodSchema)` | `.output()` or the resolver return | `protectedProcedure` | n/a (document procedure, not HTTP) |
| **FastAPI** | `@router.post("/x")`, `APIRouter(prefix=)`, `app.include_router(prefix=)` | Pydantic model params; `Query()`, `Path()`, `Header()` | `response_model=` | `Depends(get_current_user)` | `status_code=` on the decorator, else 200 |
| **Django REST Framework** | `urls.py` + router `register()`, `path()` | `Serializer` fields and `validate_*` | the serializer used for output | `permission_classes`, `authentication_classes`, settings defaults | `create` 201, else 200 |
| **Flask** | `@bp.route`, `register_blueprint(url_prefix=)` | marshmallow / pydantic / manual `request.json` reads | `jsonify` / schema dump | decorators | 200 unless returned tuple sets it |
| **Rails** | `config/routes.rb` (`resources`, `namespace`) | strong params `params.require().permit()`, model validations | serializer / jbuilder / `render json:` | `before_action` | `render status:` |
| **Laravel** | `routes/api.php` (`/api` prefix automatic), `Route::prefix` | `FormRequest::rules()` | `JsonResource` / `->json()` | `middleware('auth:sanctum')`, policies | 200; `201` if `->setStatusCode` / `response()->json(..., 201)` |
| **Spring Boot** | `@RequestMapping` on class + `@GetMapping` etc. | `@Valid @RequestBody` DTO with Jakarta Validation annotations | return type / `ResponseEntity` | Spring Security config, `@PreAuthorize` | 200; `@ResponseStatus` / `ResponseEntity.status()` |
| **ASP.NET Core** | `[Route]`, `[HttpPost]`, minimal API `MapPost`, `MapGroup` | DTO DataAnnotations / FluentValidation | return type, `Results.Created(...)` | `[Authorize(Roles=)]`, policies | depends on result helper |
| **Go (net/http, chi, gin, echo)** | `r.Route`, `r.Group`, `HandleFunc` | struct tags (`binding:"required"`, `validate:"..."`) | struct passed to `json.NewEncoder` / `c.JSON(status, ...)` | middleware chain | the status passed explicitly |
| **GraphQL** | schema type / resolver | input types and resolver checks | selection-based | context / directives | n/a — document operation, variables and error `extensions.code` |

## Mode B (endpoint does not exist): what to read on the frontend side

- The component, hook or store that needs the data and what it renders
  (every field shown is a response field; every form input is a body
  field).
- The API client and how existing calls are made (base URL, auth header,
  error parsing) — copy into `## Conventions`.
- Existing types or mocks (`types/`, `mocks/`, MSW handlers, Storybook
  fixtures) — they are the frontend's expected contract.
- One or two neighboring backend endpoints (from the API docs or the
  frontend's existing calls) to copy casing, envelope, pagination and
  error style.
- Validation the form already does client-side: the backend must enforce
  at least the same rules; list them in `Receiver notes`.

## Things that silently change the contract

- Serialization transforms: `snake_case` ↔ `camelCase` converters,
  `@Exclude`/`@Expose`, `exclude_none`, `JsonInclude.NON_NULL` (a `null`
  field may be omitted instead of sent as `null`).
- Validation pipe flags: `whitelist` strips unknown fields silently,
  `forbidNonWhitelisted` rejects them with `400`.
- Dates: `Date` objects serialize as ISO strings; numeric decimals may
  serialize as strings (`Decimal` in Python/Prisma).
- Response wrappers / interceptors that add `{ data: ... }` around every
  response.
- Global auth guards that make an endpoint authenticated unless marked
  `@Public()` or similar.
