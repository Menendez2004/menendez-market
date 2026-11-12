# menendez-market

Marketplace de plugins para Claude Code.

## Instalación

```bash
# 1. Agregar el marketplace
/plugin marketplace add Menendez2004/menendez-market

# 2. Instalar los plugins que quieras
/plugin install dev-orchestrator@menendez-market
/plugin install qa@menendez-market
/plugin install unit-test-generator@menendez-market
/plugin install api-handoff@menendez-market
/plugin install endpoint-security-audit@menendez-market
/plugin install code-pattern-review@menendez-market
/plugin install merge-readiness-review@menendez-market
/plugin install clawd-pet@menendez-market
```

(Desde la terminal también funciona: `claude plugin marketplace add Menendez2004/menendez-market`.)

## Plugins

| Plugin | Descripción |
| --- | --- |
| `dev-orchestrator` | Human-in-the-loop development orchestrator with a 2-level hierarchy. Claude lo reconoce solo, sin invocarlo: un hook `UserPromptSubmit` le da prioridad cuando pides un plan ("crea un plan", "planifica", "plan this") o una tarea de varios pasos, y en cualquier prompt en modo plan. Adopts the Lead's plan, or, if none is given, deploys a read-only Planner Agent on Opus (`orch-planner`) to draft one, then launches one Task Agent per step in its own terminal (or inline for small steps) and its own git worktree, applying each finished step to the Lead's working tree as a checked, uncommitted patch, starting each step as soon as its dependencies finish, cerrando sola la sesión (y su pestaña) de cada Task Agent en cuanto su paso queda `Complete` o `Failed` (un paso `Blocked` sigue abierto para que respondas ahí), and each agent can use read-only research sub-agents (Sonnet 5) that prioritize graphify. Si la skill `ponytail` está disponible, todo agente que escribe código la usa para no escribir código innecesario (sin recortar nada del paso ni de validaciones/seguridad). Execution runs on the latest Opus (Task Agents and the orchestrator session). Never runs tests; runs checks once at the end. No crea unit tests a menos que se pidan. El orquestador hace automáticamente un commit por cada paso terminado, como el usuario logeado en git (el agente nunca aparece como autor ni co-autor), con mensajes Conventional Commits 1.0.0, y nunca hace push (push, merge, rebase y PRs son solo del Lead). Escalates to the Lead on ambiguity or destructive actions. |
| `qa` | Suite de QA (se instala completa). Incluye las skills: `qa-orchestrator` (orquesta sesiones de QA: lanza agentes de prueba en paralelo, recolecta resultados, hace triage de bugs y genera reportes), `qa-happy-path` (prueba los flujos principales de la UI con Playwright), `qa-api-adversary` (intenta romper la API: auth, validación, duplicados, condiciones de carrera, requests malformados), `qa-debugger` (aplica correcciones mínimas a los bugs reportados) y `qa-personality-builder` (crea personalidades de QA propias del proyecto en `.qa/config.yml`). |
| `clawd-pet` | Mod (no es una skill): Clawd, la mascota de Claude, vive justo encima del prompt del CLI, a la derecha, con su laptop. Saluda cuando estás presente, teclea en su laptop mientras Claude trabaja, se pone casco en modo plan, trae un ayudante más pequeño y de su mismo color por cada subagente que esté corriendo (con lentes si investiga, con casco azul si planea, con su laptop verde azulada si programa), queda noqueado cuando falla un comando y se duerme con un "Zzz" flotando cuando dejas de escribir (60 s por defecto; cámbialo con `idleSeconds` en `/config`). Escribe cualquier cosa para despertarlo; `/pet` lo oculta o lo muestra, y `/pet color <nombre o #hex>` (o `/config`) le cambia el color: `orange`, `blue`, `green`, `purple`, `pink`, `red`, `yellow`, `gray` o cualquier hexadecimal. |
| `unit-test-generator` | Genera unit tests estrictos y aislados con el runner, la librería de mocks y las factories que ya usa el repo. Los datos salen de Faker o de factories (nunca objetos escritos a mano), con semilla fija, patrón AAA y casos de éxito, ramas, entradas inválidas, límites, errores y efectos secundarios. Exige al menos 90% de coverage (líneas, sentencias, ramas y funciones) en la unidad probada. Nunca modifica código de producción: reporta los bugs que encuentra. |
| `api-handoff` | Escribe e implementa documentos de handoff (Markdown) entre frontend y backend. Para frontend: el endpoint que debe consumir; para backend: el endpoint que debe construir. Cada endpoint lleva su finalidad, método y ruta completa, auth, parámetros, headers, el body exacto (tabla de campos + ejemplo JSON que deben coincidir), todas las respuestas de éxito y error, efectos secundarios y criterios de aceptación verificables, todo extraído del código real (lo que no está decidido queda como `TBD` + pregunta abierta). Usa una plantilla fija con front matter YAML e incluye un script validador, para que cualquier otra sesión de Claude pueda implementarlo tal cual y reportar diferencias con el contrato. |
| `endpoint-security-audit` | Auditoría de seguridad de caja blanca de los endpoints de una API y de las funciones que usan sus rutas. Arma el mapa de rutas (método, ruta completa, handler, cadena de middleware y auth) con un script incluido, y sigue cada dato del request por el handler y por cada servicio, repositorio y helper que llama. Revisa autenticación, autorización por objeto y por función (BOLA/IDOR, BFLA), inyección (SQL, NoSQL, comandos), path traversal y subida de archivos, SSRF, mass assignment, exposición de datos y rutas del servidor, rate limits y lógica de dinero (montos negativos, condiciones de carrera, idempotencia). Cada hallazgo lleva `archivo:línea`, el request que lo dispara, severidad, OWASP API Top 10 + CWE y la corrección; lo que no se puede confirmar va aparte. Solo lee código: nunca ataca un sistema en ejecución. Guarda cada reporte en `.dev/security/YYYY-MM-DD-<alcance>.md` (crea la carpeta si no existe) y no lo commitea. |
| `code-pattern-review` | Revisa un archivo o carpeta para ver si sigue las convenciones del patrón de diseño o de arquitectura que debería usar (capas, MVC, MVVM, Clean, Hexagonal, módulos por feature, CQRS, Repository, Redux, patrones GoF…) y los principios SOLID. Nunca asume el patrón: lo toma de lo que pidas, de la documentación o las reglas de límites del repo, del framework o de la convención del propio repo, y dice de dónde lo sacó. Si el código no lo sigue, identifica el patrón que realmente usa (incluidos antipatrones como big ball of mud, god object, fat controller o modelo anémico) con evidencia `archivo:línea`, indica si la desviación es deliberada o accidental y recomienda mejoras incrementales (quick wins, refactors planeados y decisiones estratégicas). También inventaría la deuda técnica (diseño, código, tests, dependencias, documentación, build/config) con un script incluido; cada punto lleva su costo actual (interés), esfuerzo y prioridad. Solo lee código: no lo modifica durante la revisión. Guarda cada reporte en `.dev/pattern-review/YYYY-MM-DD-<alcance>.md` (crea la carpeta si no existe) y no lo commitea. |
| `merge-readiness-review` | Evalúa si lo que se va a mergear a una rama (la que pidas; el origen puede ser tu rama actual, otra rama o un PR) funciona contra esa rama tal como está hoy, sin conflictos y sin romper otros flujos. Trae la rama destino actualizada, simula el merge en un git worktree temporal (nunca toca tu árbol ni tus ramas), corre los checks del propio repo (install, typecheck, lint, build, tests) primero sobre la rama destino sola (baseline) y luego sobre el resultado del merge, y clasifica cada falla como regresión, preexistente, arreglada o no verificada. Detecta conflictos textuales y semánticos (la rama destino renombró, borró o cambió algo que el código entrante usa, o al revés; migraciones que chocan) y sigue el radio de impacto: cada llamada, ruta, consumidor, contrato, migración, clave de config y dependencia que toca el cambio, en el árbol ya mergeado, marcada como verificada por un check, por lectura o no verificada. **Regla estricta:** si la skill `ponytail` está disponible, siempre se carga y se aplica al diff entrante y a cualquier corrección (nunca se instala; nunca quita validaciones, seguridad ni tests). Veredicto: Listo / Listo con condiciones / No listo, con evidencia `archivo:línea`. Incluye `scripts/merge_probe.py` (merge base, commits adelante/atrás, conflictos con `merge-tree`, archivos en ambos lados, señales de riesgo y comandos de checks detectados). Nunca hace merge, push, rebase ni commit. Guarda cada reporte en `.dev/merge-review/YYYY-MM-DD-<origen>-into-<destino>.md` (crea la carpeta si no existe) y no lo commitea. |

## Estructura

```
.claude-plugin/
  marketplace.json          # catálogo: cada plugin apunta a sus skills
plugins/
  skills/
    dev-orchestrator/       # SKILL.md + references/, rules/, agents/, hooks/route_prompt.py + close_session.py
    qa/                     # todas las skills de QA
      qa-orchestrator/        # SKILL.md + references/, rules/, assets/
      qa-happy-path/          # SKILL.md + rules/
      qa-api-adversary/       # SKILL.md + rules/
      qa-debugger/            # SKILL.md + rules/
      qa-personality-builder/ # SKILL.md + references/, rules/
    unit-test-generator/    # SKILL.md + references/, rules/
    api-handoff/            # SKILL.md + references/ (plantilla, ejemplos), rules/, scripts/validate_handoff.py
    endpoint-security-audit/ # SKILL.md + references/ (descubrimiento de rutas, sinks, OWASP, plantilla), rules/, scripts/list_routes.py
    code-pattern-review/    # SKILL.md + references/ (catálogo de patrones, catálogo de deuda técnica, plantilla), rules/, scripts/debt_scan.py
    merge-readiness-review/ # SKILL.md + references/ (checklist de impacto, ponytail, plantilla), rules/, scripts/merge_probe.py
  mods/
    clawd-pet/              # .claude-plugin/plugin.json + hooks/register.tsx, types/, tests/
```

Cada entrada de `marketplace.json` usa `"strict": false` y declara sus skills con
`"skills": [...]`. `dev-orchestrator` carga solo su skill (sus agentes
`orch-planner` y `orch-researcher`, y su hook de ruteo), `unit-test-generator`, `api-handoff`, `endpoint-security-audit`, `code-pattern-review` y `merge-readiness-review` cargan solo la suya, y el plugin `qa` carga las cinco skills de `plugins/skills/qa/`
juntas, porque `qa-orchestrator` lanza a las demás.

Para agregar una skill nueva: crea `plugins/skills/<nombre>/SKILL.md` y agrega una
entrada en `.claude-plugin/marketplace.json`. Una skill de QA nueva va en
`plugins/skills/qa/<nombre>/` y se agrega a la lista `skills` del plugin `qa`.
Valida con:

```bash
claude plugin validate .
```

Los mods (plugins de function hooks, como `clawd-pet`) viven en `plugins/mods/<nombre>/`
con su propio `.claude-plugin/plugin.json`, y su entrada en `marketplace.json` usa
`"source": "./plugins/mods/<nombre>"`. Cada cambio a un mod debe subir su `version`
(en su `plugin.json` y en su entrada de `marketplace.json`): Claude Code guarda la copia
instalada por versión, y si la versión no cambia `/plugin update` no la reemplaza. Para probarlos:

```bash
claude plugin validate plugins/mods/clawd-pet
claude plugin test plugins/mods/clawd-pet
claude --plugin-dir plugins/mods/clawd-pet   # sesión de prueba con el mod cargado
```
