# menendez-market

Marketplace de plugins para Claude Code.

## Instalación

```bash
# 1. Agregar el marketplace
/plugin marketplace add Menendez2004/menendez-market

# 2. Instalar los plugins que quieras
/plugin install dev-orchestrator@menendez-market
/plugin install qa-orchestrator@menendez-market
```

(Desde la terminal también funciona: `claude plugin marketplace add Menendez2004/menendez-market`.)

## Plugins

| Plugin | Descripción |
| --- | --- |
| `dev-orchestrator` | Orquestador de desarrollo con humano en el loop: clasifica tareas, planifica y delega a agentes worker planos, escalando al Lead ante ambigüedad o acciones destructivas. |
| `qa-orchestrator` | Orquesta sesiones de QA: lanza agentes de prueba en paralelo, recolecta resultados, hace triage de bugs y genera reportes. |

## Estructura

```
.claude-plugin/
  marketplace.json          # catálogo del marketplace (solo manifiestos aquí)
plugins/
  <plugin>/
    .claude-plugin/
      plugin.json           # manifiesto del plugin
    skills/
      <skill>/SKILL.md      # skill + references/, rules/, assets/
```

Para agregar un plugin nuevo: crea `plugins/<nombre>/` con su `.claude-plugin/plugin.json`
y sus `skills/`, agrégalo a `.claude-plugin/marketplace.json` y valida con:

```bash
claude plugin validate .
claude plugin validate plugins/<nombre>
```
