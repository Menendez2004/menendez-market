# menendez-market

Marketplace de plugins para Claude Code.

## Instalación

```bash
# 1. Agregar el marketplace
/plugin marketplace add Menendez2004/menendez-market

# 2. Instalar los plugins que quieras
/plugin install dev-orchestrator@menendez-market
/plugin install qa-orchestrator@menendez-market
/plugin install qa-happy-path@menendez-market
/plugin install qa-api-adversary@menendez-market
/plugin install qa-debugger@menendez-market
/plugin install qa-personality-builder@menendez-market
```

(Desde la terminal también funciona: `claude plugin marketplace add Menendez2004/menendez-market`.)

## Plugins

| Plugin | Descripción |
| --- | --- |
| `dev-orchestrator` | Human-in-the-loop development orchestrator with a 2-level hierarchy: adopts the Lead's plan (or proposes one with opus if none is given), launches one Task Agent per step in its own terminal, running independent steps in parallel waves, and each agent can use read-only research sub-agents that prioritize graphify. Never runs tests; runs checks once at the end. Escalates to the Lead on ambiguity or destructive actions. |
| `qa-orchestrator` | Orquesta sesiones de QA: lanza agentes de prueba en paralelo, recolecta resultados, hace triage de bugs y genera reportes. Usa qa-happy-path, qa-api-adversary y qa-debugger. |
| `qa-happy-path` | Prueba los flujos principales de la UI con Playwright y reporta bugs con pasos de reproducción. |
| `qa-api-adversary` | Intenta romper la API: auth, validación de entrada, duplicados, condiciones de carrera y requests malformados. |
| `qa-debugger` | Recibe los bugs de QA y aplica correcciones mínimas con un reporte por bug. |
| `qa-personality-builder` | Crea personalidades de QA propias del proyecto y las registra en `.qa/config.yml`. |

## Estructura

```
.claude-plugin/
  marketplace.json          # catálogo: cada plugin apunta a su skill
plugins/
  skills/
    dev-orchestrator/       # SKILL.md + references/, rules/
    qa-orchestrator/        # SKILL.md + references/, rules/, assets/
    qa-happy-path/          # SKILL.md + rules/
    qa-api-adversary/       # SKILL.md + rules/
    qa-debugger/            # SKILL.md + rules/
    qa-personality-builder/ # SKILL.md + references/, rules/
```

Cada entrada de `marketplace.json` usa `"strict": false` y declara su skill con
`"skills": ["./plugins/skills/<nombre>"]`, así cada plugin se instala por separado
y solo carga su propia skill.

Para agregar una skill nueva: crea `plugins/skills/<nombre>/SKILL.md`, agrega una
entrada en `.claude-plugin/marketplace.json` y valida con:

```bash
claude plugin validate .
```
