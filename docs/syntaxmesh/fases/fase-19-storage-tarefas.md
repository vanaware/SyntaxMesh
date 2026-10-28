# Fase 19 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-19-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-19-storage.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~85 tarefas
> **Concluídas:** 0
> **Fonte:** `@vanaware/workerdb` (já pronto) + extensão SyntaxMesh

> **📌 Âncora — fachada CLI `TaskJuggler` que depende de fonte/destino de
> arquivo (audit 2026-10-27, Fases 2–11).** O motor de parse (Fase 10) está
> pronto e testado via `ProjectFileParser` (conteúdo em buffer); o que falta é
> o **transporte de arquivo** que esses três stubs da fachada exigem:
>
> - `taskjuggler.ts:28` `parse(files, keepParser)` (`NotYetImplementedError("10")`)
>   — TaskJuggler.rb:46-101: abrir cada arquivo + `parse(:project)`/`:propertiesFile`.
> - `taskjuggler.ts:31` `parseFile(fileName, rule)` — stub (TaskJuggler.rb:105+).
> - `taskjuggler.ts:36` `parseContent(content)` (`NotYetImplementedError("19")`)
>   — variante com conteúdo direto (já referenciado por `ProjectLoader`, 24.8.5).
>
> No PWA, `files`/`fileName` vir do `FileStore` (`worker-db`/OPFS), não do `fs`
> do Node. Implementar os três sobre o `FileStore`/`ProjectLoader` desta fase.

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa segue TDD.** Antes de implementar:

1. Escrever o teste que falha.
2. `deno task test` → confirmar falha correta.
3. Implementar o mínimo.
4. `deno task test` → passa.
5. `deno task check-all` → verde.
6. Commit atômico.
7. Marcar `[x]`.

### Contexto crítico

- `@vanaware/workerdb` **já existe** (Fase 1). **Não modificá-lo.**
- Storage **consome** `worker-db`, expondo serviços de mais alto nível.
- `ProjectService`, `Autosave`, `Recovery`, `SettingsService`, `ImportExport`, `ProjectLoader`.
- Schema de dados versionado (`DATA_SCHEMA_VERSION = 1`).
- Testes usam `fakeOpfs()` do `worker-db`.
- Fase 18 precisa ser corrigida para usar `fakeOpfs()` em vez de fallback `Map`.
- `addToScm` deve delegar para `FileStore` injetado (interface definida em Core).
- Snapshot tests garantem integridade byte-a-byte.

### Convenções

- Toda API é `async`.
- Erros: `StorageError`, `NotFoundError`, `QuotaExceededError`, `SchemaVersionError`.
- `crypto.randomUUID()` para IDs.
- `ProjectLoader` usa `TaskJuggler.parseContent` (Fase 10).
- Commit por subfase: `feat(storage): project-service`, etc.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não modificar `@vanaware/workerdb`.
- ❌ Não usar IndexedDB ou OPFS diretamente.
- ❌ Não importar `@syntaxmesh/core/storage` em Core (ADR 001).
- ❌ Não implementar fake de FS próprio — usar `fakeOpfs()`.

---

## Progresso

```
[ ] 24.0  ADR 030 (schema versionado)              —  0/4
[ ] 24.1  schema + migrations                      —  0/8
[ ] 24.2  mod.ts (exports)                         —  0/3
[ ] 24.3  ProjectService                           —  0/12
[ ] 24.4  Autosave                                 —  0/8
[ ] 24.5  Recovery                                 —  0/8
[ ] 24.6  SettingsService                          —  0/7
[ ] 24.7  ImportExport                             —  0/10
[ ] 24.8  ProjectLoader                            —  0/6
[ ] 24.9  Corrigir Fase 18 (fakeOpfs)              —  0/6
[ ] 24.10 Substituir addToScm no-op                —  0/4
[ ] 24.11 Integração UI (doc)                      —  0/2
[ ] 24.12 Snapshot tests (persistência)            —  0/7
[ ] 24.13 Verificação final                        —  0/8
────────────────────────────────────────────────────
TOTAL: ~85
```

---

## Bloco A — Fundação

### 24.0 — ADR 030 (schema versionado)

**⚠️ Nota:** o plano usa ADR 030.

**Objetivo:** formalizar o versionamento do schema de dados e a política de migração.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.0.1 | Criar `docs/syntaxmesh/decisoes/030-storage-schema.md` com frontmatter | idem | arquivo existe |
| 24.0.2 | Seção **Contexto:** `worker-db` é transparente; nossa camada versiona dados | idem | — |
| 24.0.3 | Seção **Decisões:** `DATA_SCHEMA_VERSION = 1`; estrutura KV (`projects/<id>`, `settings`); estrutura FS (`projects/`, `timesheets/`, `templates/`, `unsaved/`, `outbox/`); migrações declarativas; backup antes de migrar | idem | — |
| 24.0.4 | Atualizar linha `030` em `decisoes/README.md` | idem | 30 linhas |

---

### 24.1 — `schema.ts` + `migrations.ts`

**Objetivo:** definir constantes de schema e funções de migração.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.1.1 | Criar `packages/core/src/storage/schema.ts` com `DATA_SCHEMA_VERSION = 1` | idem | `deno check` |
| 24.1.2 | Definir `KV_KEYS` (`PROJECT_META_PREFIX`, `SETTINGS`) e `FS_PATHS` (`PROJECTS`, `TIMESHEETS`, `TEMPLATES`, `UNSAVED`, `OUTBOX`) | idem | `deno check` |
| 24.1.3 | Definir `interface ProjectMeta` com `schemaVersion` | idem | `deno check` |
| 24.1.4 | Definir `interface Settings` com `schemaVersion` | idem | `deno check` |
| 24.1.5 | Criar `packages/core/src/storage/migrations.ts` com `interface Migration` | idem | `deno check` |
| 24.1.6 | Implementar `migrateProjectMeta(meta: ProjectMeta): ProjectMeta` | idem | 3 testes |
| 24.1.7 | Teste: `migrateProjectMeta` no-op para `schemaVersion: 1` | idem | 1 teste |
| 24.1.8 | Teste: `migrateProjectMeta` lança para versão desconhecida | idem | 1 teste |

---

### 24.2 — `mod.ts` (exports)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.2.1 | Exportar tipos `ProjectMeta`, `Settings`, `KeyValueStore`, `FileStore` | `packages/core/src/storage/mod.ts` | `deno check` |
| 24.2.2 | Exportar serviços e erros | idem | `deno check` |
| 24.2.3 | Criar `packages/core/src/storage/deno.jsonc` (se não existir) | idem | `deno check` |

---

## Bloco B — Serviços

### 24.3 — `ProjectService`

**Objetivo:** CRUD de projetos.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.3.1 | Criar `packages/core/src/storage/project-service.ts` com classe vazia | idem | `deno check` |
| 24.3.2 | Constructor recebe `{ kv: KeyValueStore, fs: FileStore }` | idem | 2 testes |
| 24.3.3 | Implementar `list(): Promise<ProjectMeta[]>` | idem | 2 testes |
| 24.3.4 | Implementar `create(name, content): Promise<string>` | idem | 3 testes |
| 24.3.5 | Implementar `read(id): Promise<string>` (lança `NotFoundError`) | idem | 2 testes |
| 24.3.6 | Implementar `getMeta(id): Promise<ProjectMeta>` | idem | 2 testes |
| 24.3.7 | Implementar `update(id, content): Promise<void>` | idem | 2 testes |
| 24.3.8 | Implementar `delete(id): Promise<void>` | idem | 2 testes |
| 24.3.9 | Implementar `rename(id, name): Promise<void>` | idem | 2 testes |
| 24.3.10 | Implementar `duplicate(id): Promise<string>` | idem | 2 testes |
| 24.3.11 | Teste agregado: CRUD completo | idem | 1 teste |
| 24.3.12 | Usar `crypto.randomUUID()` para IDs | idem | 1 teste |

---

### 24.4 — `Autosave`

**Objetivo:** autosave debounced.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.4.1 | Criar `packages/core/src/storage/autosave.ts` com classe vazia | idem | `deno check` |
| 24.4.2 | Constructor recebe `(service: ProjectService, delayMs = 500)` | idem | 2 testes |
| 24.4.3 | Implementar `schedule(id, content): void` (debounce) | idem | 3 testes |
| 24.4.4 | Implementar `flush(): Promise<void>` | idem | 2 testes |
| 24.4.5 | Implementar `cancel(): void` | idem | 2 testes |
| 24.4.6 | Implementar `pendingCount(): number` | idem | 1 teste |
| 24.4.7 | Implementar `dispose(): void` | idem | 1 teste |
| 24.4.8 | Teste: múltiplos `schedule` substituem | idem | 1 teste |

---

### 24.5 — `Recovery`

**Objetivo:** recuperação após crash.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.5.1 | Criar `packages/core/src/storage/recovery.ts` com classe vazia | idem | `deno check` |
| 24.5.2 | Constructor recebe `fs: FileStore` | idem | 2 testes |
| 24.5.3 | Implementar `markUnsaved(id, content): Promise<void>` | idem | 2 testes |
| 24.5.4 | Implementar `hasUnsaved(): Promise<boolean>` | idem | 2 testes |
| 24.5.5 | Implementar `listUnsaved(): Promise<string[]>` | idem | 2 testes |
| 24.5.6 | Implementar `recover(id): Promise<{ id, content } \| null>` | idem | 2 testes |
| 24.5.7 | Implementar `discard(id): Promise<void>` e `clearAll(): Promise<void>` | idem | 2 testes |
| 24.5.8 | Teste agregado: ciclo completo | idem | 1 teste |

---

### 24.6 — `SettingsService`

**Objetivo:** gerenciar configurações.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.6.1 | Criar `packages/core/src/storage/settings.ts` com classe vazia | idem | `deno check` |
| 24.6.2 | Constructor recebe `kv: KeyValueStore` | idem | 2 testes |
| 24.6.3 | Implementar `get(): Promise<Settings>` com defaults | idem | 3 testes |
| 24.6.4 | Implementar `set(partial): Promise<void>` | idem | 2 testes |
| 24.6.5 | Implementar `reset(): Promise<void>` | idem | 2 testes |
| 24.6.6 | Teste: `set` preserva campos não alterados | idem | 1 teste |
| 24.6.7 | Teste: defaults corretos | idem | 1 teste |

---

### 24.7 — `ImportExport`

**Objetivo:** import/export de `.tjp`, `.tji`, `.json`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.7.1 | Criar `packages/core/src/storage/import-export.ts` com classe vazia | idem | `deno check` |
| 24.7.2 | Constructor recebe `(service, fs)` | idem | 2 testes |
| 24.7.3 | Implementar `importTjp(file): Promise<string>` | idem | 3 testes |
| 24.7.4 | Implementar `exportTjp(id): Promise<{ name, content }>` | idem | 2 testes |
| 24.7.5 | Implementar `importTji(file): Promise<void>` | idem | 2 testes |
| 24.7.6 | Implementar `exportTji(path): Promise<{ name, content }>` | idem | 2 testes |
| 24.7.7 | Implementar `exportJson(id): Promise<{ name, content }>` | idem | 2 testes |
| 24.7.8 | Implementar `importJson(file): Promise<string>` | idem | 2 testes |
| 24.7.9 | Teste: round-trip JSON | idem | 1 teste |
| 24.7.10 | Teste: nome sem extensão | idem | 1 teste |

---

### 24.8 — `ProjectLoader`

**Objetivo:** carregar `.tjp` e retornar `Project`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.8.1 | Criar `packages/core/src/storage/project-loader.ts` com classe vazia | idem | `deno check` |
| 24.8.2 | Constructor recebe `fs: FileStore` | idem | 2 testes |
| 24.8.3 | Implementar `loadFromContent(content): Promise<Project>` | idem | 3 testes |
| 24.8.4 | Implementar `loadFromFs(path): Promise<Project>` | idem | 2 testes |
| 24.8.5 | Usar `TaskJuggler.parseContent` (adicionar se necessário) | idem | 1 teste |
| 24.8.6 | Teste: erro de parse lança | idem | 1 teste |

---

## Bloco C — Correções e integração

### 24.9 — Corrigir Fase 18 para usar `fakeOpfs()`

**Objetivo:** substituir fallback `Map<string, string>` por `fakeOpfs()`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.9.1 | Atualizar `SheetHandlerBase` para receber `FileStore` injetado | `packages/core/src/sheets/sheet-handler-base.ts` | `deno check` |
| 24.9.2 | Definir interface `FileStore` em `packages/core/src/interfaces/file-store.ts` | idem | `deno check` |
| 24.9.3 | Atualizar testes da Fase 18 para usar `fakeOpfs()` | `packages/core/tests/sheets/*.ts` | testes passam |
| 24.9.4 | Remover fallback `Map<string, string>` | idem | grep `Map<string, string>` retorna 0 |
| 24.9.5 | Re-rodar todos os testes da Fase 18 | idem | verde |
| 24.9.6 | Atualizar documentação da Fase 18 se necessário | `docs/syntaxmesh/fases/fase-18-time-status-sheets.md` | nota adicionada |

---

### 24.10 — Substituir `addToScm` no-op

**Objetivo:** `addToScm` deve delegar para `FileStore`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.10.1 | Atualizar `addToScm` em `SheetHandlerBase` para delegar | `packages/core/src/sheets/sheet-handler-base.ts` | 3 testes |
| 24.10.2 | Se `fileStore === null`, no-op; se `scmCommand`, warning | idem | 2 testes |
| 24.10.3 | Atualizar testes da Fase 18 | idem | verde |
| 24.10.4 | Teste: `addToScm` persiste via `FileStore` | idem | 1 teste |

---

### 24.11 — Integração com UI (doc)

**Objetivo:** documentar contrato para a Fase 20.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.11.1 | Adicionar seção em `fase-20-pwa-ui.md` sobre injeção dos serviços | idem | seção existe |
| 24.11.2 | Teste: nada a implementar | idem | — |

---

## Bloco D — Snapshot tests

### 24.12 — Snapshot tests (persistência)

**Objetivo:** validar que `.tjp` salvo e recuperado é idêntico.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.12.1 | Criar `packages/core/tests/storage/golden/persistence.golden.json` | idem | `deno check` |
| 24.12.2 | Lista de fixtures: todos os 9 MWEs | idem | ≥ 9 fixtures |
| 24.12.3 | Para cada: `service.create` + `service.read` | idem | 9 testes |
| 24.12.4 | Testar `autosave` → `recovery` | idem | 2 testes |
| 24.12.5 | Testar `exportJson` + `importJson` round-trip | idem | 3 testes |
| 24.12.6 | Criar `packages/core/tests/storage/golden/persistence_golden_test.ts` | idem | `deno check` |
| 24.12.7 | Cobertura ≥ 15 casos | idem | verde |

---

## Bloco E — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 24.13.1 | `deno task check-all` verde | exit 0 |
| 24.13.2 | `deno task test` verde | exit 0 |
| 24.13.3 | `grep -r "NotYetImplementedError" packages/core/src/storage/` = 0 | grep |
| 24.13.4 | ADR 030 criada e commitada | git log |
| 24.13.5 | Todos os serviços exportados em `packages/core/src/storage/mod.ts` | `deno check` |
| 24.13.6 | `tests/integration/smoke_after_phase_19_test.ts` — cria projeto via `ProjectService`, salva, lê de volta; verifica Fase 18 (`SheetHandlerBase`) | 1 teste |
| 24.13.7 | Auditoria: cada subfase do plano `fase-19-storage.md` tem tarefas correspondentes | grep |
| 24.13.8 | Corrigir numeração em `fase-19-storage.md` (`### 24.X` → `### 19.X`? Verificar se necessário) | grep |

---

## Notas para a IA

1. **Ordem:** 24.0 → 24.1 → 24.2 → 24.3 → 24.4 → 24.5 → 24.6 → 24.7 → 24.8 → 24.9 → 24.10 → 24.11 → 24.12 → 24.13.
2. **`@vanaware/workerdb` já existe.** Não modificá-lo.
3. **Usar `fakeOpfs()`** em todos os testes que tocam FS.
4. **Core define `FileStore` em `interfaces/`.** Storage implementa.
5. **Core não importa `@syntaxmesh/core/storage`.** Injeção via setter.
6. **Schema de dados versionado.** `DATA_SCHEMA_VERSION = 1`.
7. **`Autosave` é debounced.** 500ms default.
8. **`Recovery` usa `unsaved/`.**
9. **`crypto.randomUUID()`** para IDs.
10. **`ProjectLoader`** usa `TaskJuggler.parseContent`.
11. **`addToScm`** delega para `FileStore`.
12. **Fase 18 corrigida** para usar `fakeOpfs()`.
13. **Snapshot tests** byte-a-byte.
14. **Sem `any`.** Use `unknown` + narrowing.
15. **Commit por subfase.** `feat(storage): project-service`, etc.

---

## ADR 030 (referência rápida)

Criado como subfase 24.0. Conteúdo esperado:

- **Título:** Schema versionado e migrações de storage
- **Contexto:** `worker-db` transparente; nossa camada versiona dados.
- **Decisões:**
  - `DATA_SCHEMA_VERSION = 1`.
  - Estrutura KV e FS.
  - Migrações declarativas.
  - Backup antes de migrar.
- **Alternativas:** sem versionamento.
- **Consequências:** evolução segura.

---

## Adendo Fase 10 Complemento: image store OPFS (#5 RDO)

> **Origem:** `fase-10-complemento1.md` §6.6 (Storage). A resolução de caminho relativo (OPFS primeiro, fallback `dataDirs`) é consumida pela Fase 13 (adendo 13.14) e pela Fase 14 (`RdoReport`).

```
[ ] 24.14  image-store.ts                        —  0/4
[ ] 24.15  Imagens em export/backup              —  0/2
[ ] 24.16  Integração Markdown/RDO (doc)         —  0/1
```

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 24.14.1 | Criar `storage/projects/image-store.ts`: `write(projectId, relPath, Blob)`, `read(projectId, relPath): Blob|null`, `delete`, `list` — via `FileStore` do `@vanaware/workerdb` (**não** tocar OPFS direto) | `storage/projects/image-store.ts` | 4 testes com `fakeOpfs()` |
| 24.14.2 | Raiz por projeto (`projects/<id>/`); caminhos relativos normalizados (sem `..`, sem absolutos) | idem | 2 testes |
| 24.14.3 | expor `image-store` em `mod.ts` | `storage/mod.ts` | `deno check` |
| 24.14.4 | Sem `any`; API `async`; erros `StorageError`/`NotFoundError` | — | lint |
| 24.15.1 | Imagens entram no export/backup do projeto junto dos `.tjp` | `storage/import-export.ts` | 1 teste |
| 24.15.2 | `DATA_SCHEMA_VERSION`: imagens não exigem migração (FS, não KV) — registrar em ADR 030 | decisoes/… | — |
| 24.16.1 | Contrato: `FileStore` injetável no renderizador Markdown (Fase 13, tarefa 13.14.2) e no `RdoReport` (Fase 14, tarefa 14.25.9) | doc no plano da fase | — |

---

**Fim do arquivo de tarefas da Fase 19.**