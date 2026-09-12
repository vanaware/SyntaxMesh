# Fase 19 — Storage

> **Arquivo:** `docs/syntaxmesh/fases/fase-19-storage.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 4–5 dias
> **Depende de:** Fases 4, 9, 18
> **Bloqueia:** Fases 18 (SCM/OPFS), 20, 21

---

## 1. Contexto

Esta fase implementa a **camada de persistência** do SyntaxMesh consumindo `@syntaxmesh/worker-db`, que já está pronto.

### Divisão de responsabilidades

```
UI (Fase 20)
   ↓
@  syntaxmesh/storage   ← ESTA FASE
   ↓
@syntaxmesh/worker-db   ← JÁ EXISTE (não tocar)
   ↓
Web Worker
   ↓
IndexedDB + OPFS
```

- **`@syntaxmesh/worker-db`** (Fase 1, já pronto): expõe KV e FS via Web Worker. Inclui `fake-opfs()` para testes.
- **`@syntaxmesh/storage`** (esta fase): expõe `ProjectService`, `Autosave`, `Recovery`, `ImportExport`, `SettingsService`, `ProjectLoader`.

**Regra crítica:** Storage **não contamina Core**. Core é sempre in-memory. Storage persiste.

### API presumida do `worker-db`

Conforme documento de arquitetura (Fase 1):

```ts
// key-value store
interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

// file store
interface FileStore {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  delete(path: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}

// factory
function createWorkerDbClient(): WorkerDbClient;
function fakeOpfs(): FileStore;   // ← usado em testes
```

**Se a API real divergir, ajustar imports aqui.** Nesta fase não modificamos `worker-db`.

### O que é persistido

1. **Projetos `.tjp`** — arquivos de projeto.
2. **Submissões `.tji`** — time sheets e status sheets (Fase 18).
3. **Metadados** — nome, data de criação, autosave.
4. **Configurações** — locale, tema, preferências.
5. **Templates** — time sheet templates (Fase 18).
6. **Snapshots** — versionamento opcional via OPFS.

### IndexedDB vs OPFS

| Aspecto | IndexedDB | OPFS |
|---|---|---|
| Uso | Metadados, settings | Arquivos grandes (`.tjp`, `.tji`) |
| Ideal para | JSON pequeno | Arquivos texto |

**Decisão:** metadados em KV; arquivos em FS. Ambos via `worker-db`.

### Integração com Fase 18

Fase 18 deixou `addToScm` como no-op e usou fallback `Map<string, string>`. Nesta fase:
- `addToScm` passa a delegar ao `FileStore` **injetado** (interface, sem import).
- Fase 18 é **corrigida** para usar `fakeOpfs()` do `worker-db` em testes.

---

## 2. Objetivo

Ao final desta fase:

- `@syntaxmesh/storage` completo:
  - `ProjectService` (CRUD).
  - `Autosave` (debounced).
  - `Recovery` (após crash).
  - `ImportExport` (`.tjp`, `.tji`, `.json`).
  - `SettingsService` (locale, tema).
  - `ProjectLoader` (carrega `.tjp` do FS).
- Integração com `@syntaxmesh/worker-db` (sem modificá-lo).
- **Fase 18 corrigida** para usar `fakeOpfs()` em testes.
- **≥ 80 testes unitários** + **≥ 15 snapshot tests** (persistência de `.tjp`).
- ADR 030 registrado.
- `deno task check-all` verde.

---

## 3. Referências

### 3.1 Bibliotecas

- **`@syntaxmesh/worker-db`** — pacote interno. Já pronto.
- **`@syntaxmesh/utils`** — helpers (se aplicável).

### 3.2 Sem referência TaskJuggler

TaskJuggler é Ruby/CLI, sem persistência browser. Fase específica do SyntaxMesh.

### 3.3 Documentos de referência

- `docs/syntaxmesh/03-arquitetura.md` — seção Storage.
- `docs/syntaxmesh/decisoes/003-storage-nao-contamina-core.md`.
- `docs/syntaxmesh/decisoes/010-worker-db-centraliza-storage.md`.
- ADR 005 (browser only).

---

## 4. Decisões de port

### 4.1 Consumir `worker-db`, não reimplementar

Toda interação com IndexedDB/OPFS passa por `@syntaxmesh/worker-db`. Nesta fase **não** criamos Worker, protocol, stores ou client — eles já existem.

### 4.2 Interface `KeyValueStore` e `FileStore` injetadas

Para desacoplar de `worker-db` em testes e permitir injeção:

- `ProjectService` recebe `{ kv: KeyValueStore, fs: FileStore }` no construtor.
- Testes passam `fakeOpfs()` do `worker-db`.

### 4.3 Fake de testes vem do `worker-db`

**Não** implementamos fake in-memory próprio. Usamos `fakeOpfs()` do `worker-db`.

Se `worker-db` também expõe `fakeKv()` (ou equivalente), usamos. Senão, o `fakeOpfs()` é o padrão.

### 4.4 Schema versionado no KV

IndexedDB tem versionamento nativo. O `worker-db` é transparente. Nossa camada lida com migração de **formato de dados**, não de DB.

**Schema de dados** (não de DB):

```
kv['projects/<id>'] = ProjectMeta (v1)
kv['settings'] = Settings (v1)
fs['projects/<id>.tjp'] = texto
fs['unsaved/<id>.tjp'] = texto
fs['timesheets/<date>/<res>.tji'] = texto
fs['templates/<date>/<res>.tji'] = texto
fs['outbox/<to>_<date>.eml'] = texto
```

### 4.5 Estrutura de pastas em OPFS

```
/ (root OPFS)
├── projects/
│   └── <id>.tjp
├── timesheets/
│   └── <date>/<resourceId>.tji
├── templates/
│   └── <date>/<resourceId>.tji
├── unsaved/
│   └── <id>.tjp
└── outbox/
    └── <to>_<date>.eml
```

### 4.6 ProjectService

```ts
interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sizeBytes: number;
  scenarioCount: number;
  schemaVersion: number;  // 1
}
```

### 4.7 Autosave

Debounced (500ms). Salva `.tjp` + metadados.

### 4.8 Recovery

Ao abrir, verifica `unsaved/`. Se existe, oferece recuperar.

### 4.9 Import/Export

- `importTjp(file: { name, content })`: cria.
- `exportTjp(id)`: retorna `{ name, content }`.
- `importTji`, `exportTji`.
- `exportJson(id)`, `importJson(json)`.

### 4.10 Settings service

```ts
interface Settings {
  locale: string;                    // 'en' | 'pt-BR' | 'es'
  theme: 'light' | 'dark' | 'auto';
  fontSize: number;
  autosaveMs: number;
  schemaVersion: number;             // 1
}
```

### 4.11 ProjectLoader

```ts
class ProjectLoader {
  constructor(private fs: FileStore);
  loadFromFs(path: string): Promise<Project>;
  loadFromContent(content: string): Promise<Project>;
}
```

**Nota:** `TaskJuggler.parse` (Fase 9) é stub. Nesta fase, `ProjectLoader.loadFromContent` usa `parse([content], ...)` variante ou `Project` construído manualmente até Fase 10 completar. **Fase 10 já implementou parser**, então `parseContent` deve estar disponível.

Se `TaskJuggler` ainda não expõe `parseContent`, `ProjectLoader` levanta `NotYetImplementedError` (fallback para Fase 21).

### 4.12 Migração de schema

Se `ProjectMeta.schemaVersion < SCHEMA_VERSION`, roda `migrateProject(meta)`.

Migrações registradas em `migrations.ts`. Backup antes de migrar (Fase 20).

### 4.13 Erros

- `StorageError extends TjError` — base.
- `NotFoundError`, `QuotaExceededError`, `SchemaVersionError`.

### 4.14 Promise-based API

Toda API é `async`. Sem callbacks.

### 4.15 Injeção para Fase 18

`SheetHandlerBase.setFileStore(fs)` — Core **não importa** `@syntaxmesh/storage`. Interface `FileStore` fica em `packages/core/src/interfaces/`.

---

## 5. Subfases detalhadas

**Bloco A — Fundação** (24.0–24.2)
**Bloco B — Serviços** (24.3–24.8)
**Bloco C — Integração** (24.9–24.11)
**Bloco D — Snapshot tests** (24.12)

---

### Bloco A — Fundação

---

### 19.0 — ADR 030 (schema versionado e migrações)

#### Contexto

O `worker-db` (já pronto) é transparente ao versionamento do IndexedDB. Nossa camada precisa versionar o **formato dos dados** persistidos.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/030-storage-schema.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/030-storage-schema.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** `worker-db` transparente; nossa camada versiona dados.
- [ ] **Decisões:**
  - `DATA_SCHEMA_VERSION = 1`.
  - Estrutura KV: `projects/<id>`, `settings`.
  - Estrutura FS: `projects/`, `timesheets/`, `templates/`, `unsaved/`, `outbox/`.
  - Migrações declarativas em `migrations.ts`.
  - Backup antes de migrar.
- [ ] **Alternativas:** sem versionamento (frágil).
- [ ] **Consequências:** evolução segura; complexidade mínima.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- ADR 010.
- `docs/syntaxmesh/03-arquitetura.md` — seção Storage.

#### Critério de aceite

- ADR 030 criado.

---

### 19.1 — `schema.ts` + `migrations.ts`

#### Contexto

Definição do schema de dados e migrações.

#### Objetivo

Implementar.

#### Arquivos

- `packages/storage/src/schema.ts`
- `packages/storage/src/migrations.ts`
- `packages/storage/tests/migrations_test.ts`

#### Requisitos

**`schema.ts`:**

- [ ] `const DATA_SCHEMA_VERSION = 1`.
- [ ] `const KV_KEYS = { PROJECT_META_PREFIX: 'projects/', SETTINGS: 'settings' }`.
- [ ] `const FS_PATHS = { PROJECTS: 'projects', TIMESHEETS: 'timesheets', TEMPLATES: 'templates', UNSAVED: 'unsaved', OUTBOX: 'outbox' }`.
- [ ] `interface ProjectMeta` com `schemaVersion`.
- [ ] `interface Settings` com `schemaVersion`.

**`migrations.ts`:**

- [ ] `interface Migration { fromVersion: number; apply(meta: ProjectMeta): ProjectMeta }`.
- [ ] `const PROJECT_MIGRATIONS: Migration[] = []`.
- [ ] `migrateProjectMeta(meta: ProjectMeta): ProjectMeta`:
  - Se `meta.schemaVersion === DATA_SCHEMA_VERSION`, retorna meta.
  - Senão, aplica migrações em sequência.

#### Critério de aceite

```ts
const meta = { schemaVersion: 1, ... };
assertEquals(migrateProjectMeta(meta).schemaVersion, 1);
```

#### Testes

- `migrations_test.ts`:
  - `it("DATA_SCHEMA_VERSION = 1")`.
  - `it("migrateProjectMeta no-op v1")`.
  - `it("migrateProjectMeta erro versão desconhecida")`.

---

### 19.2 — `mod.ts` (Storage exports)

#### Contexto

Entry point.

#### Objetivo

Exportar tudo.

#### Arquivos

- `packages/storage/mod.ts`

#### Requisitos

- [ ] Exporta tipos: `ProjectMeta`, `Settings`, `KeyValueStore`, `FileStore`.
- [ ] Exporta `ProjectService`, `Autosave`, `Recovery`, `ImportExport`, `SettingsService`, `ProjectLoader`.
- [ ] Exporta erros: `StorageError`, `NotFoundError`, `QuotaExceededError`, `SchemaVersionError`.

---

### Bloco B — Serviços

---

### 19.3 — `ProjectService`

#### Contexto

CRUD de projetos.

#### Objetivo

Implementar `ProjectService`.

#### Arquivos

- `packages/storage/src/project-service.ts`
- `packages/storage/tests/project-service_test.ts`

#### Requisitos

- [ ] `class ProjectService`:
  - `private kv: KeyValueStore`
  - `private fs: FileStore`
- [ ] Constructor `(deps: { kv: KeyValueStore, fs: FileStore })`.
- [ ] `list(): Promise<ProjectMeta[]>`:
  - `kv.keys()` filtrando `projects/`.
  - `Promise.all(map(meta => kv.get(meta)))`.
- [ ] `create(name, content): Promise<string>`:
  - `id = crypto.randomUUID()`.
  - `fs.write('projects/<id>.tjp', content)`.
  - `meta = { id, name, createdAt: Date.now(), updatedAt: Date.now(), sizeBytes: content.length, scenarioCount: 0, schemaVersion: 1 }`.
  - `kv.set('projects/<id>', meta)`.
  - Retorna `id`.
- [ ] `read(id): Promise<string>`:
  - `fs.read('projects/<id>.tjp')`.
  - Se não existe, `throw NotFoundError`.
- [ ] `getMeta(id): Promise<ProjectMeta>`.
- [ ] `update(id, content): Promise<void>`:
  - `fs.write(...)`.
  - `meta.updatedAt = Date.now()`.
  - `meta.sizeBytes = content.length`.
  - `kv.set(...)`.
- [ ] `delete(id): Promise<void>`:
  - `fs.delete('projects/<id>.tjp')`.
  - `kv.del('projects/<id>')`.
- [ ] `rename(id, name): Promise<void>`.
- [ ] `duplicate(id): Promise<string>`:
  - Lê, cria com `"<name> (copy)"`.

#### Critério de aceite

```ts
const svc = new ProjectService({ kv: fakeKv, fs: fakeOpfs() });
const id = await svc.create("Meu Projeto", "project p1 ...");
assertEquals(await svc.read(id), "project p1 ...");
assertEquals((await svc.list()).length, 1);
```

#### Testes

- `project-service_test.ts`:
  - `it("create")`.
  - `it("read")`.
  - `it("read NotFoundError")`.
  - `it("update")`.
  - `it("delete")`.
  - `it("list")`.
  - `it("rename")`.
  - `it("duplicate")`.
  - `it("getMeta")`.

---

### 19.4 — `Autosave`

#### Contexto

Autosave debounced.

#### Objetivo

Implementar `Autosave`.

#### Arquivos

- `packages/storage/src/autosave.ts`
- `packages/storage/tests/autosave_test.ts`

#### Requisitos

- [ ] `class Autosave`:
  - `private service: ProjectService`
  - `private pending: Map<string, string>`
  - `private timeout: number | null`
  - `private delayMs: number`
- [ ] Constructor `(service, delayMs = 500)`.
- [ ] `schedule(id, content): void`:
  - `pending.set(id, content)`.
  - Reinicia `timeout` (clearTimeout + setTimeout).
- [ ] `flush(): Promise<void>`:
  - Salva todos `pending` via `service.update`.
  - Limpa.
- [ ] `cancel(): void`:
  - `clearTimeout`. Limpa `pending`.
- [ ] `pendingCount(): number`.
- [ ] `dispose(): void`.

#### Critério de aceite

```ts
const auto = new Autosave(svc, 50);
auto.schedule('id1', 'content');
await new Promise(r => setTimeout(r, 100));
assertEquals(await svc.read('id1'), 'content');
```

#### Testes

- `autosave_test.ts`:
  - `it("schedule depois delay salva")`.
  - `it("schedule múltiplas vezes substitui")`.
  - `it("flush força salvamento")`.
  - `it("cancel descarta")`.
  - `it("pendingCount")`.
  - `it("dispose cancela")`.

---

### 19.5 — `Recovery`

#### Contexto

Recuperar após crash.

#### Objetivo

Implementar `Recovery`.

#### Arquivos

- `packages/storage/src/recovery.ts`
- `packages/storage/tests/recovery_test.ts`

#### Requisitos

- [ ] `class Recovery`:
  - `private fs: FileStore`
- [ ] Constructor `(fs)`.
- [ ] `markUnsaved(id, content): Promise<void>`:
  - `fs.write('unsaved/<id>.tjp', content)`.
- [ ] `hasUnsaved(): Promise<boolean>`:
  - `(await fs.list('unsaved')).length > 0`.
- [ ] `listUnsaved(): Promise<string[]>`.
- [ ] `recover(id): Promise<{ id, content } | null>`:
  - Lê `unsaved/<id>.tjp`.
- [ ] `discard(id): Promise<void>`.
- [ ] `clearAll(): Promise<void>`.

#### Critério de aceite

```ts
const rec = new Recovery(fakeOpfs());
await rec.markUnsaved('id1', 'content');
assert(await rec.hasUnsaved());
const r = await rec.recover('id1');
assertEquals(r?.content, 'content');
```

#### Testes

- `recovery_test.ts`:
  - `it("markUnsaved")`.
  - `it("hasUnsaved true/false")`.
  - `it("listUnsaved")`.
  - `it("recover")`.
  - `it("discard")`.
  - `it("clearAll")`.

---

### 19.6 — `SettingsService`

#### Contexto

Configurações do usuário.

#### Objetivo

Implementar.

#### Arquivos

- `packages/storage/src/settings.ts`
- `packages/storage/tests/settings_test.ts`

#### Requisitos

- [ ] `class SettingsService`:
  - `private kv: KeyValueStore`
- [ ] Constructor `(kv)`.
- [ ] `get(): Promise<Settings>`:
  - Se não existe, retorna defaults.
- [ ] `set(partial: Partial<Settings>): Promise<void>`.
- [ ] `reset(): Promise<void>`.
- [ ] Defaults:
  ```ts
  {
    locale: 'en',
    theme: 'auto',
    fontSize: 14,
    autosaveMs: 500,
    schemaVersion: 1,
  }
  ```

#### Critério de aceite

```ts
const s = new SettingsService(fakeKv);
assertEquals((await s.get()).locale, 'en');
await s.set({ locale: 'pt-BR' });
assertEquals((await s.get()).locale, 'pt-BR');
```

#### Testes

- `settings_test.ts`:
  - `it("get defaults")`.
  - `it("set partial")`.
  - `it("set preserva outros campos")`.
  - `it("reset")`.

---

### 19.7 — `ImportExport`

#### Contexto

Import/export de `.tjp`, `.tji`, `.json`.

#### Objetivo

Implementar.

#### Arquivos

- `packages/storage/src/import-export.ts`
- `packages/storage/tests/import-export_test.ts`

#### Requisitos

- [ ] `class ImportExport`:
  - `private service: ProjectService`
  - `private fs: FileStore`
- [ ] `importTjp(file: { name, content }): Promise<string>`:
  - Nome sem extensão.
  - `service.create(name, content)`.
- [ ] `exportTjp(id): Promise<{ name, content }>`.
- [ ] `importTji(file: { name, content }): Promise<void>`:
  - `fs.write('timesheets/<name>', content)`.
- [ ] `exportTji(path): Promise<{ name, content }>`.
- [ ] `exportJson(id): Promise<{ name, content }>`:
  - Estrutura: `{ meta, tjp, schemaVersion }`.
- [ ] `importJson(file: { name, content }): Promise<string>`.

#### Critério de aceite

```ts
const ie = new ImportExport(svc, fakeOpfs());
const id = await ie.importTjp({ name: 'test.tjp', content: 'project p1 ...' });
const exp = await ie.exportJson(id);
assert(JSON.parse(exp.content).tjp === 'project p1 ...');
```

#### Testes

- `import-export_test.ts`:
  - `it("importTjp")`.
  - `it("exportTjp")`.
  - `it("importTji")`.
  - `it("exportTji")`.
  - `it("exportJson")`.
  - `it("importJson")`.

---

### 19.8 — `ProjectLoader`

#### Contexto

Carrega `.tjp` do FS e retorna `Project` (Fase 9).

#### Objetivo

Implementar `ProjectLoader`.

#### Arquivos

- `packages/storage/src/project-loader.ts`
- `packages/storage/tests/project-loader_test.ts`

#### Requisitos

- [ ] `class ProjectLoader`:
  - `private fs: FileStore`
- [ ] Constructor `(fs)`.
- [ ] `loadFromContent(content: string): Promise<Project>`:
  - `tj = new TaskJuggler()`.
  - `tj.parseContent(content)` ou equivalente — depende do que Fase 9/10 expõe.
  - `tj.schedule()`.
  - Retorna `tj.project`.
- [ ] `loadFromFs(path): Promise<Project>`:
  - Lê `fs.read(path)`.
  - Chama `loadFromContent`.

**Nota:** `TaskJuggler.parseContent` precisa existir. Se Fase 9/10 só expõem `parse(files[])`, esta fase adiciona `parseContent` (não intrusivo).

#### Critério de aceite

```ts
const loader = new ProjectLoader(fakeOpfs());
const project = await loader.loadFromContent('project p1 ...');
assert(project !== null);
```

#### Testes

- `project-loader_test.ts`:
  - `it("loadFromContent ok")`.
  - `it("loadFromContent erro")`.
  - `it("loadFromFs")`.

---

### Bloco C — Integração

---

### 19.9 — Corrigir Fase 18 para usar `fakeOpfs()`

#### Contexto

Fase 18 usou fallback `Map<string, string>`. Como `worker-db` já existe com `fakeOpfs()`, devemos corrigir.

#### Objetivo

Substituir fallback.

#### Arquivos

- `packages/core/src/sheets/sheet-handler-base.ts` (atualizar)
- `packages/core/tests/sheets/*.ts` (atualizar)
- `docs/syntaxmesh/fases/fase-18-time-status-sheets.md` (atualizar nota)

#### Requisitos

- [ ] `SheetHandlerBase` recebe `FileStore` **injetado** via setter.
- [ ] Interface `FileStore` fica em `packages/core/src/interfaces/file-store.ts` (Core define, Storage implementa).
- [ ] Testes da Fase 18 usam `fakeOpfs()` do `worker-db`.
- [ ] Remover `Map<string, string>` fallback.

**Interface em Core (não importa Storage):**

```ts
// packages/core/src/interfaces/file-store.ts
export interface FileStore {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  delete(path: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}
```

**Import nos testes da Fase 18:**

```ts
import { fakeOpfs } from "@syntaxmesh/worker-db";
```

#### Critério de aceite

- Testes da Fase 18 passam com `fakeOpfs()`.

#### Testes

- Testes da Fase 18 re-rodados.

---

### 19.10 — Substituir `addToScm` no-op

#### Contexto

Fase 18 deixou `addToScm` como no-op. Nesta fase, persistimos em OPFS.

#### Objetivo

Substituir.

#### Arquivos

- `packages/core/src/sheets/sheet-handler-base.ts` (atualizar)
- Testes da Fase 18 atualizados.

#### Requisitos

- [ ] `addToScm(message, fileName)`:
  - Se `fileStore === null`, no-op.
  - Senão, delega para `fileStore.write(fileName, content)` (o conteúdo já foi escrito antes).
  - Se `scmCommand !== null`, `warning('scm_not_supported_in_browser')`.

**Nota:** Core **não importa** Storage. Só usa interface.

#### Critério de aceite

- `addToScm` persiste via `FileStore`.

#### Testes

- Testes da Fase 18 atualizados.

---

### 19.11 — Integração com UI (referência)

#### Contexto

UI (Fase 20) consumirá `ProjectService`.

#### Objetivo

Documentar contrato.

#### Arquivos

- `docs/syntaxmesh/fases/fase-20-pwa-ui.md` (referência cruzada).

#### Requisitos

- [ ] Documentar que `ProjectService`, `Autosave`, `SettingsService` serão injetados na UI via service layer.
- [ ] Nada a implementar aqui.

#### Critério de aceite

- Nota no documento da Fase 20.

---

### Bloco D — Snapshot tests

---

### 19.12 — Snapshot tests (persistência)

#### Contexto

Validar que `.tjp` salvo e recuperado é idêntico.

#### Objetivo

Snapshots.

#### Arquivos

- `packages/storage/tests/golden/persistence.golden.json`
- `packages/storage/tests/golden/persistence_golden_test.ts`

#### Requisitos

- [ ] Para cada MWE (Fase 2, `docs/Learning/mwe001-009/`):
  - Lê `.tjp` original.
  - `service.create`.
  - `service.read`.
  - Compara byte-a-byte.
- [ ] Testa `autosave` → `recovery`.
- [ ] Testa `exportJson` + `importJson` round-trip.
- [ ] ≥ 15 casos.

#### Critério de aceite

```bash
deno task test
```

- ≥ 15 casos.
- Todos passam.

#### Testes

- `persistence_golden_test.ts`:
  - `describe("Persistence snapshots")` — itera.

---

## 6. Ordem de execução sugerida

```text
24.0  ADR 030
      ↓
24.1  schema + migrations
24.2  mod.ts
      ↓
24.3  ProjectService
24.4  Autosave
24.5  Recovery
24.6  SettingsService
24.7  ImportExport
24.8  ProjectLoader
      ↓
24.9  Corrigir Fase 18 (fakeOpfs)
24.10 Substituir addToScm
24.11 Integração UI (doc)
      ↓
24.12 Snapshot tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 19 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `@syntaxmesh/storage` completo.
- [ ] `worker-db` **não foi modificado**.
- [ ] Fase 18 corrigida para usar `fakeOpfs()`.
- [ ] `addToScm` funcional (injeção).
- [ ] `ProjectLoader` funcional.
- [ ] **≥ 80 testes unitários**.
- [ ] **≥ 15 snapshot tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] ADR 030 criado.

---

## 8. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| API do `worker-db` divergir do presumido | Médio | Ajustar imports; não modificar worker-db |
| `TaskJuggler.parseContent` não existir | Médio | Adicionar variante nesta fase |
| `crypto.randomUUID()` em Deno antigo | Baixo | Fallback UUID v4 |
| Schema migração errada perde dados | **Alto** | Backup antes de migrar |
| Autosave dispara muito | Médio | Debounce 500ms |
| Recovery com arquivo grande | Médio | Lazy load |
| `fs.list` com prefixos | Médio | Testes com subpastas |
| Quota excedida | Alto | Tratamento + limpeza |
| Core importar Storage por engano | **Alto** | Interface em `core/interfaces/` |

---

## 9. Referências cruzadas

### Documentos do projeto

- `docs/syntaxmesh/03-arquitetura.md` — seção Storage.
- `docs/syntaxmesh/decisoes/003-storage-nao-contamina-core.md`.
- `docs/syntaxmesh/decisoes/010-worker-db-centraliza-storage.md`.
- `docs/syntaxmesh/decisoes/030-storage-schema.md` (novo).

### Fases dependentes

- **Fase 20 — UI** (consome `ProjectService`).
- **Fase 21 — Compatibilidade** (persistência cross-browser).

### Fases referenciadas

- **Fase 1** — `@syntaxmesh/worker-db` (já pronto).
- **Fase 9** — `Project`.
- **Fase 10** — Parser (`parseContent`).
- **Fase 18** — `addToScm` real.

---

## 10. Notas para a IA

1. **`@syntaxmesh/worker-db` já está pronto.** Não modificar.
2. **Consumir `fakeOpfs()`** em testes.
3. **Core define `FileStore` em `interfaces/`.** Storage implementa.
4. **Core não importa Storage.** Injeção via setter.
5. **Schema de dados versionado.** `DATA_SCHEMA_VERSION = 1`.
6. **Autosave debounced.** 500ms.
7. **Recovery** checa `unsaved/` ao abrir.
8. **`crypto.randomUUID()`** para IDs.
9. **`ProjectLoader`** usa `parseContent` (adicionar se necessário).
10. **`addToScm`** delega para `FileStore`.
11. **Fase 18 corrigida** para usar `fakeOpfs()`.
12. **Sem `any`.** Use `unknown` + narrowing.
13. **Commit por subfase.** `feat(storage): project-service`, etc.
14. **Snapshot tests** byte-a-byte.

---

## 11. ADR 030 (referência rápida)

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

**Fim da Fase 19.**