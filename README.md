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
/plugin install clawd-pet@menendez-market
```

(Desde la terminal también funciona: `claude plugin marketplace add Menendez2004/menendez-market`.)

## Plugins

| Plugin | Descripción |
| --- | --- |
| `dev-orchestrator` | Human-in-the-loop development orchestrator with a 2-level hierarchy: adopts the Lead's plan (or drafts one in plan mode under opusplan if none is given), launches one Task Agent per step in its own terminal (or inline for small steps) and its own git worktree, applying each finished step to the Lead's working tree as a checked, uncommitted patch, starting each step as soon as its dependencies finish, and each agent can use read-only research sub-agents (Sonnet 4.6) that prioritize graphify. Execution runs on the latest Sonnet. Never runs tests; runs checks once at the end. Escalates to the Lead on ambiguity or destructive actions. |
| `qa` | Suite de QA (se instala completa). Incluye las skills: `qa-orchestrator` (orquesta sesiones de QA: lanza agentes de prueba en paralelo, recolecta resultados, hace triage de bugs y genera reportes), `qa-happy-path` (prueba los flujos principales de la UI con Playwright), `qa-api-adversary` (intenta romper la API: auth, validación, duplicados, condiciones de carrera, requests malformados), `qa-debugger` (aplica correcciones mínimas a los bugs reportados) y `qa-personality-builder` (crea personalidades de QA propias del proyecto en `.qa/config.yml`). |
| `clawd-pet` | Mod (no es una skill): Clawd, la mascota de Claude, vive en la esquina inferior derecha del CLI, bajo el prompt, con su laptop. Saluda cuando estás presente, teclea en su laptop mientras Claude trabaja y se duerme con un "Zzz" flotando cuando dejas de escribir (60 s por defecto; cámbialo con `idleSeconds` en `/config`). Escribe cualquier cosa para despertarlo; `/pet` lo oculta o lo muestra. |
| `unit-test-generator` | Genera unit tests estrictos y aislados con el runner, la librería de mocks y las factories que ya usa el repo. Los datos salen de Faker o de factories (nunca objetos escritos a mano), con semilla fija, patrón AAA y casos de éxito, ramas, entradas inválidas, límites, errores y efectos secundarios. Exige al menos 90% de coverage (líneas, sentencias, ramas y funciones) en la unidad probada. Nunca modifica código de producción: reporta los bugs que encuentra. |

## Estructura

```
.claude-plugin/
  marketplace.json          # catálogo: cada plugin apunta a sus skills
plugins/
  skills/
    dev-orchestrator/       # SKILL.md + references/, rules/
    qa/                     # todas las skills de QA
      qa-orchestrator/        # SKILL.md + references/, rules/, assets/
      qa-happy-path/          # SKILL.md + rules/
      qa-api-adversary/       # SKILL.md + rules/
      qa-debugger/            # SKILL.md + rules/
      qa-personality-builder/ # SKILL.md + references/, rules/
    unit-test-generator/    # SKILL.md + references/, rules/
  mods/
    clawd-pet/              # .claude-plugin/plugin.json + hooks/register.tsx, types/, tests/
```

Cada entrada de `marketplace.json` usa `"strict": false` y declara sus skills con
`"skills": [...]`. `dev-orchestrator` carga solo su skill (y su agente
`orch-researcher`), `unit-test-generator` carga solo la suya, y el plugin `qa` carga las cinco skills de `plugins/skills/qa/`
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
