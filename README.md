# USKids Golf

App React + pipeline de scraping de resultados USKids Golf (2002–2026).

## Estado dos dados

Os `public/batch_001.json` … `batch_017.json` contêm **788 torneios com jogadores** (≈136 k inscrições). Cada jogador tem `first`, `last`, `country`, `place`, `teeMarkerColor` e `strokes` por buraco.

Limitação do scrape original (PowerShell, Março 2026):

- Não chamou `GetTournamentPlayers` → não temos o **memberId USKids global** dos miúdos. A chave no `flight_players` é o `pid` local ao flight, que não cruza com o `uskids-member-history-slim.json` do golf-fpg.
- Usou o endpoint legacy `GET ...&t=0`, que devolve `flight_players:{}` para torneios encerrados. Alguns torneios podem estar incompletos por isso.

## Actualizar os dados — 2 scripts

Dois scripts Node 18+ (sem dependências) que substituem o pipeline antigo (browser console + `uskids_scrape.ps1`):

1. `scripts/discover-uskids.js` — refaz a Fase 1+2: descobre torneios novos em `tournaments.uskidsgolf.com` e actualiza a master list (`public/arquivo/all_tournaments_consolidated.json`).
2. `scripts/update-uskids.js` — corre a Fase 3: scrapa scorecards + memberIds para os torneios da master list que ainda não estão nos `batch_*.json`.

**Fluxo típico de actualização (corre os dois em sequência):**

```powershell
cd C:\uskids-golf
node scripts/discover-uskids.js                 # apanha tcodes novos de 2025+2026
node scripts/update-uskids.js --since 2026      # scrapa só os de 2026 (incremental)
```

### Pré-requisitos

- Node ≥ 18 (vem com `fetch` nativo)
- `public/arquivo/all_tournaments_consolidated.json` (já existe — master list de 1145 torneios)
- Os ficheiros `public/batch_*.json` actuais (para o script saber o que já está feito)

### Comandos

```powershell
cd C:\uskids-golf

# Default: scrapa torneios desde 2025 que ainda não estão em nenhum batch
node scripts/update-uskids.js

# Janela mais larga
node scripts/update-uskids.js --since 2024

# Re-scrapar torneios específicos (mesmo que já existam)
node scripts/update-uskids.js --force --tcodes 21080,18242,18124

# Ver primeiro o que vai scrapar, sem chamar a API
node scripts/update-uskids.js --since 2026 --dry-run

# Sintonia fina
node scripts/update-uskids.js --since 2025 --concurrency 5 --delay 200 --batch-size 20

# Testar com poucos torneios
node scripts/update-uskids.js --since 2026 --max 5
```

### Flags do `update-uskids.js`

| Flag | Default | O que faz |
|---|---|---|
| `--since YYYY` | `2025` | Só torneios com `year >= YYYY` |
| `--tcodes a,b,c` | — | Lista específica de tcodes signupanytime. **Bypassa a master list** — se o tcode não estiver lá, o script vai à API buscar o nome/ano via GetMeta |
| `--force` | off | Não saltar torneios já presentes nos `batch_*.json` |
| `--exclude-cat a,b` | `teen-series,teen-world` | Categorias a excluir (Teen Series e Teen World são 13-18, irrelevantes para o tracker do Manuel). Passar `--exclude-cat ""` para não excluir nada |
| `--only-cat a,b` | — | Limita às categorias indicadas (ex: `world,regional,international-local`) |
| `--concurrency N` | `3` | Workers paralelos. ≤5 é cortês |
| `--delay MS` | `300` | Pausa entre chamadas dentro de cada worker |
| `--batch-size N` | `10` | Quantos torneios por ficheiro `batch_NNN.json` |
| `--max N` | sem limite | Pára após N torneios (debug) |
| `--dry-run` | off | Lista candidatos e sai |

### Flags do `discover-uskids.js`

| Flag | Default | O que faz |
|---|---|---|
| `--years a,b,c` | ano corrente + anterior | Anos a varrer |
| `--slugs a,b` | todas excepto teen-* | Categorias a varrer (`world`, `regional`, `state`, `girls-invitationals`, `local-tours`, `teen-series`, `teen-world`) |
| `--include-teen` | off | Inclui Teen Series e Teen World |
| `--concurrency N` | `5` | Páginas em paralelo |
| `--delay MS` | `200` | Pausa entre páginas |
| `--dry-run` | off | Lista tcodes novos sem alterar a master list |

### Output

Os novos batches continuam a numeração: se o último era `batch_017.json`, o script começa em `batch_018.json`. Cada flight ganha agora dois campos novos:

```json
"memberIds": ["591440", "591441", ...],
"pid_to_member_id": { "3112": "591440" }
```

`memberIds` é a lista crua de `PlayerNodeId` que `GetTournamentPlayers` devolve para esse flight. `pid_to_member_id` é o mapeamento directo quando o player object tem algum dos campos candidatos (`node_id`/`member_id`/`mid`/etc.) ou quando o pid coincide com um dos memberIds.

Para os casos sem match directo (a maioria), o cross-ref tem de ser feito downstream — strokes fingerprint dentro de `(tcode, ageGroup)` cruzando com o `uskids-member-history-slim.json` do golf-fpg.

### Notas técnicas

- O script chama `GetPlayerTeeTimes` via **POST** com `t=1&pt=undefined&jbgr={ts}&c=1`. Isto é o que a UI moderna do signupanytime usa e funciona para torneios encerrados. Faz fallback para o legacy `GET ...&t=0` se vier vazio.
- Sem auth — todos os endpoints são públicos.
- Rate limiting cooperativo: 300 ms entre chamadas × concorrência 3 ≈ 10 req/s. Scrapar a master list inteira (~613 torneios × ~7 flights) leva ~2 h.

## Histórico

- `public/RESUMO_PROJETO_USKIDS_v4.md` — descrição completa do pipeline original (Março 2026)
- `public/arquivo/uskids_scrape.ps1` — script PowerShell antigo (deprecado pelo `scripts/update-uskids.js`)
- `public/arquivo/all_tournaments_consolidated.json` — master list de 1145 torneios mapeados (613 com signupanytime_t acessível)
