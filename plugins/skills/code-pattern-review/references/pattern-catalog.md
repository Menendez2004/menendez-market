# Pattern Catalog

For each pattern: **Conventions** (turn them into the C1..Cn checklist when
it is the expected pattern) and **Detection signals** (match them when
identifying the actual pattern). Conventions are checked against imports
and calls, never against folder names alone.

## Contents

- Architectural: Layered / N-tier · MVC (and MTV) · MVVM · Clean
  Architecture · Hexagonal (Ports & Adapters) · Feature / vertical slice
  modules · CQRS · Event-driven · Microservices / modular monolith
- Data access: Repository · Active Record · Data Mapper · Transaction
  Script · Domain Model (rich) vs. anemic model
- Frontend: Container/Presentational · Flux / Redux · Atomic design ·
  Hooks-based composition
- Design patterns (GoF): Strategy · Factory / Abstract Factory · Builder ·
  Singleton · Adapter · Facade · Decorator · Observer · Command ·
  Template Method · Dependency Injection
- Anti-patterns: Big ball of mud · God object · Fat controller · Anemic
  domain model · Service locator · Golden hammer · Spaghetti / callback hell ·
  Lava flow · Copy-paste programming

---

## Architectural patterns

### Layered / N-tier (controller → service → repository)

**Conventions**
- C1 Each layer calls only the layer directly below (presentation →
  business → data). No skipping (controller → DB) and no calls upward.
- C2 Controllers/handlers only parse input, call one service, map the
  result to a response. No business rules, no queries.
- C3 Services hold business rules and transactions; they do not know HTTP
  (`req`, `res`, status codes) or view concerns.
- C4 Repositories/DAOs are the only code that talks to the database.
- C5 DTOs or mappers separate transport shapes from persistence entities.
- C6 Errors are raised as domain/service errors and mapped to HTTP in one
  place (error middleware / exception filter).

**Detection signals:** folders `controllers/`, `services/`,
`repositories/`/`dao/`; imports flow one way; Spring `@Controller` →
`@Service` → `@Repository`; NestJS controllers/providers.

### MVC (and Django MTV)

**Conventions**
- C1 Models own data and domain behavior (validations, associations,
  domain methods).
- C2 Controllers (Django: views) are thin: receive request, call
  models/services, choose a view.
- C3 Views (Django: templates) render only: no queries, no business rules,
  minimal logic.
- C4 Routing is declarative and separate from controllers.
- C5 Framework conventions for naming and placement are respected
  (`UsersController`, `app/models/user.rb`, `app_name/views.py`).

**Detection signals:** `models/`, `views/`, `controllers/`; Rails,
Laravel, ASP.NET MVC, Express + template engine, Django apps.
**Common drift:** fat controllers, queries in templates, anemic models.

### MVVM

**Conventions**
- C1 Views bind to a ViewModel; they contain no business or data-access logic.
- C2 ViewModels expose state and commands, do not reference view
  components/widgets directly.
- C3 Models/services are injected into ViewModels.
- C4 State changes flow through observable bindings (LiveData, StateFlow,
  `ObservableObject`, signals), not manual view updates.

**Detection signals:** `*ViewModel` classes, data binding, SwiftUI
`@StateObject`, Android Jetpack, WPF/MAUI `INotifyPropertyChanged`.

### Clean Architecture

**Conventions**
- C1 Dependency rule: source dependencies point inward only
  (frameworks & drivers → interface adapters → use cases → entities).
- C2 Entities and use cases import no framework, ORM, HTTP or UI package.
- C3 Each use case (interactor) is one application operation with an
  explicit input and output (request/response models).
- C4 Use cases depend on gateway interfaces they own; implementations
  live in the outer layer.
- C5 Controllers/presenters convert between transport and use-case
  models; frameworks are wired in a composition root (`main`, DI module).
- C6 Business rules are testable without DB, web server or UI.

**Detection signals:** `entities/`/`domain/`, `use-cases/`/`application/`,
`adapters/`/`interface-adapters/`, `infrastructure/`/`frameworks/`;
classes named `*UseCase`/`*Interactor`.

### Hexagonal (Ports & Adapters)

**Conventions**
- C1 The domain/application core has no dependency on adapters, frameworks
  or infrastructure.
- C2 Ports are interfaces owned by the core: driving ports (use cases the
  outside calls) and driven ports (repositories, gateways the core needs).
- C3 Adapters implement driven ports (DB, HTTP clients, queues) or call
  driving ports (REST controllers, CLI, consumers); adapters never call
  each other's internals.
- C4 Wiring happens in a composition root; the core never instantiates an
  adapter.
- C5 Domain models are not ORM entities (no ORM decorators/annotations in
  the core); mapping lives in the adapter.
- C6 The core can be tested with in-memory adapters.

**Detection signals:** `domain/`, `application/`, `ports/` (`in`/`out`),
`adapters/` (`inbound`/`outbound`), `infrastructure/`; interfaces named
`*Port`, `*Repository`, `*Gateway` in the core.
**Common drift:** ORM decorators in domain entities; services doing
`new Adapter()`; ports defined next to the adapter instead of the core.

### Feature modules / vertical slices

**Conventions**
- C1 Code is grouped by feature (`orders/`, `billing/`), each with its
  own handlers, logic, data access and tests.
- C2 Features talk to each other only through a public API (index file,
  module exports, events), never by importing another feature's internals.
- C3 Shared code (`shared/`, `common/`) is small, generic and has no
  feature-specific logic.
- C4 A change to one feature rarely touches another feature's folder.

**Detection signals:** top-level folders named after business features;
NestJS modules; Angular feature modules; `features/*` in frontends;
Nx/Turborepo libs with boundaries.
**Common drift:** a growing `shared/utils` god module; cross-feature deep imports.

### CQRS

**Conventions**
- C1 Commands (change state, return nothing or an ID) are separate from
  queries (return data, no side effects).
- C2 Each command/query has its own handler.
- C3 Read models may be denormalized and are not used to enforce invariants.
- C4 Validation and authorization happen per command.

**Detection signals:** `commands/`, `queries/`, `*CommandHandler`,
`*QueryHandler`, a mediator/bus (MediatR, `@nestjs/cqrs`).

### Event-driven

**Conventions**
- C1 Events are named in the past tense (`OrderPlaced`) and are immutable.
- C2 Publishers do not know their subscribers.
- C3 Handlers are idempotent and tolerate out-of-order or duplicate delivery.
- C4 Event schemas are versioned and documented.
- C5 Failure handling exists (retries, dead-letter queue, outbox for
  publish-after-commit).

**Detection signals:** `EventEmitter`, message brokers (Kafka, RabbitMQ,
SQS, Pub/Sub), `events/`, `handlers/`/`consumers/`, outbox tables.

### Microservices / modular monolith

**Conventions**
- C1 Each service/module owns its data; no shared database tables across
  services.
- C2 Communication only through published APIs or events.
- C3 Services are independently deployable/testable (own build, config, tests).
- C4 No distributed monolith: a feature change does not require
  coordinated deploys of many services.

**Detection signals:** several deployables (`services/*` each with its
own Dockerfile/package), API gateways, contracts (OpenAPI, protobuf).

---

## Data access patterns

### Repository
- C1 Collection-like interface in domain terms (`findById`, `save`,
  `findActiveByCustomer`), not generic SQL passthroughs.
- C2 Returns domain objects, not raw rows or ORM query builders.
- C3 Callers never build queries; query logic lives inside the repository.
- C4 Interface owned by the domain/application; implementation in infrastructure.
- **Signals:** `*Repository` classes/interfaces. **Drift:** repositories
  that expose `query(sql)`, return `QueryBuilder`, or are bypassed.

### Active Record
- C1 Model classes map 1:1 to tables and carry persistence methods
  (`user.save()`, `User.where(...)`).
- C2 Domain behavior lives in the model, complex queries in scopes.
- **Signals:** Rails ActiveRecord, Laravel Eloquent, Django ORM models,
  Sequelize/TypeORM `BaseEntity`. Fine for CRUD-heavy apps; debt when
  domain logic grows complex and couples to the DB.

### Data Mapper
- C1 Domain objects know nothing about persistence; a mapper/ORM unit of
  work persists them.
- **Signals:** Hibernate/JPA with plain entities, Doctrine, TypeORM
  `DataSource.getRepository`, SQLAlchemy classical mapping.

### Transaction Script
- One procedure per business operation that does everything (validate,
  query, compute, write). **Signals:** long service functions/handlers
  with inline SQL/ORM calls and little domain modeling. Fine for simple
  CRUD; debt once rules repeat across scripts.

### Domain Model (rich) vs. anemic model
- **Rich:** entities enforce invariants with behavior (`order.cancel()`),
  setters are restricted.
- **Anemic signals:** entities are only getters/setters/fields; all rules
  in "services" that mutate fields directly. Anti-pattern when the code
  claims DDD/Clean/Hexagonal.

---

## Frontend patterns

### Container / Presentational
- C1 Presentational components receive data and callbacks via props, hold
  only UI state, do no fetching.
- C2 Containers (or hooks) fetch, hold state and pass data down.
- **Drift:** components that fetch, transform and render; prop drilling
  through many levels.

### Flux / Redux (and similar stores: Zustand, Pinia, NgRx)
- C1 State changes only through actions/reducers/store methods; no direct
  mutation from components.
- C2 Reducers are pure; side effects in thunks/sagas/effects/RTK Query.
- C3 Derived data via selectors, not duplicated in state.
- C4 Server cache is not duplicated into global state when a data-fetching
  library manages it.

### Atomic design
- C1 atoms → molecules → organisms → templates → pages; lower levels never
  import higher ones.
- C2 Atoms/molecules contain no business logic or data fetching.

### Hooks-based composition (React)
- C1 Reusable logic in custom `use*` hooks; components focus on rendering.
- C2 Rules of hooks respected; effects have correct dependencies and cleanup.
- C3 Business logic in plain functions that hooks call, so it can be unit tested.

---

## Design patterns (GoF and DI)

| Pattern | Conventions to check | Detection signals | Common misuse |
|---|---|---|---|
| **Strategy** | Common interface; context receives the strategy; selection in one place | `*Strategy`, maps of handlers by key | Strategy with one implementation; selection logic duplicated |
| **Factory / Abstract Factory** | Creation logic centralized; returns abstractions | `create*`, `*Factory` | Factory that only calls `new` with no variation |
| **Builder** | Fluent steps, `build()` validates and returns an immutable object | `*Builder`, chained `with*` | Builder for 2-field objects |
| **Singleton** | Single instance justified (config, pool); injectable/replaceable in tests | `getInstance()`, module-level instances | Global mutable state hiding dependencies (breaks DIP) |
| **Adapter** | Translates a third-party/legacy API to an interface the app owns | `*Adapter`, wrappers around SDKs | Adapter that leaks the SDK's types |
| **Facade** | Simplifies a subsystem behind a small API | `*Facade`, `*Client` wrappers | Facade that becomes a god object |
| **Decorator** | Same interface as the wrapped object; adds behavior (cache, retry, log) | wrappers, HOCs, TS/Python decorators | Decorators with hidden ordering dependencies |
| **Observer / Pub-Sub** | Subjects do not know concrete observers; unsubscribe/cleanup exists | `on/emit`, `subscribe`, RxJS | Leaked listeners; event chains impossible to trace |
| **Command** | Request as an object with `execute` (and maybe `undo`) | `*Command`, job payloads | Commands that reach into global state |
| **Template Method** | Base defines algorithm skeleton; subclasses fill steps | abstract base with hooks | Deep inheritance; prefer composition/strategy |
| **Dependency Injection** | Dependencies passed in (constructor/params); wiring in a composition root or container | constructors with interfaces, NestJS/Spring/InversifyJS/tsyringe | Service locator calls (`container.get()`) spread inside business code |

---

## Anti-patterns

| Anti-pattern | Detection signals | Typical fix direction |
|---|---|---|
| **Big ball of mud** | No discernible structure; cyclic imports; everything imports everything | Draw module boundaries; extract one cohesive module at a time |
| **God object / god module** | One class/file with many unrelated responsibilities, hundreds of lines, imported everywhere (`utils`, `helpers`, `AppService`) | Split by responsibility (SRP); move functions next to their only callers |
| **Fat controller** | Business rules, queries and formatting in handlers | Extract service/use case; controllers delegate |
| **Anemic domain model** | Entities are data bags; services mutate fields | Move invariants into entity methods |
| **Service locator** | `container.get(X)`/global registries inside business code | Constructor injection |
| **Golden hammer** | The same pattern forced everywhere (e.g. generic repository for every table, Redux for local UI state) | Use the simplest pattern that fits each case |
| **Spaghetti / callback hell** | Deep nesting, jumps between callbacks, shared mutable state | async/await, extract functions, early returns |
| **Lava flow** | Old code nobody understands or dares to delete, commented-out blocks, unused exports | Confirm unused (search, coverage), delete |
| **Copy-paste programming** | Duplicated blocks with small variations | Extract and parameterize |
| **Circular dependencies** | Module A imports B imports A (check with `madge --circular`, dependency-cruiser) | Extract shared abstraction or invert one dependency |
