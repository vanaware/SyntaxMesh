# Injeção de `FileStore`/`KeyValueStore` no core

**Status:** Aceito
**Data:** 2026-11-05
**Fase:** 18 (Time/Status Sheets); consumidores futuros: 19 (Storage), 20 (PWA), 24 (CLI)

## Contexto

O `SheetHandlerBase` do TaskJuggler lê e escreve arquivos:

- `TimeSheetTemplates/<data>/<recurso>_<data>.tji` (templates gerados),
- `TimeSheetTemplates/<data>/resources.yml` (lista de recursos; vira `.json`),
- `TimeSheets/<data>/<recurso>_<data>.tji` (submissões aceitas),
- `TimeSheets/FailedMails/<digest>`, `TimeSheets/FailedSheets/…` (diagnóstico),
- `acceptable_intervals` (assinaturas aceitas),
- `all.tji` (arquivo de inclusão por diretório),
- `timesheets.log` / `statussheets.log`.

No SyntaxMesh o **core não pode importar Storage** (ADR 001/003): `Storage`
(`@syntaxmesh/worker-db`, Fase 19) depende de OPFS/IndexedDB, que só existe no
browser. O core também precisa rodar sob Deno na CLI (Fase 24), onde OPFS não
existe.

Ao mesmo tempo, os testes de sheets não podem depender de disco real: o ADR 027
já fixou que os relatórios retornam strings e o pipeline é livre de I/O.

## Decisão

1. O **core define as interfaces** em `packages/core/src/interfaces/`:

   ```ts
   export interface FileStore {
     read(path: string): Promise<string>;
     write(path: string, content: string): Promise<void>;
     delete(path: string): Promise<void>;
     list(dir: string): Promise<string[]>;
     exists(path: string): Promise<boolean>;
     mkdir(path: string): Promise<void>;
   }

   export interface KeyValueStore {
     get<T>(key: string): Promise<T | undefined>;
     set<T>(key: string, value: T): Promise<void>;
     del(key: string): Promise<void>;
     keys(): Promise<string[]>;
   }
   ```

   As interfaces são **estruturais**: qualquer objeto que satisfaça a forma é
   aceito, sem `implements` obrigatório e sem dependência nominal.

2. A implementação real vem de fora: `@syntaxmesh/worker-db` (Fase 19) para o
   browser (OPFS + IndexedDB) e um adaptador de disco para a CLI (Fase 24).

3. A injeção é explícita, via `SheetHandlerBase#setFileStore(fs)` (e
   `getFileStore()`). Nada é resolvido por singleton global, `Proxy` ou import
   condicional.

4. Todos os métodos que tocam o `FileStore` são `async`. Não existe `fs.write`
   síncrono (OPFS não oferece).

   > Refinamento do 18.10: `list(dir)` devolve as **entradas** imediatas do
   > diretório (arquivos **e** subdiretórios), como `readdir`. É o que permite
   > ao `StatusSheetSender` descobrir as pastas de período `TimeSheets/<data>`
   > (o Ruby usava `Dir.glob("TimeSheets/????-??-??")`).

5. Nos **testes** o `FileStore` é substituído por um fake em memória
   (`packages/core/tests/helpers/fake-opfs.ts`), que também serve de prova de
   conformidade estrutural. O plano original previa `fakeOpfs()` de
   `@syntaxmesh/worker-db`; como esse pacote ainda não existe (Fase 19), o fake
   vive em `tests/helpers/` com o mesmo contrato — a Fase 19 pode promovê-lo.

6. O core **nunca** importa `@syntaxmesh/worker-db`, nem em `src/`
   (`grep` como gate em 18.14.4).

## Alternativas consideradas

- **Core importar Storage** — viola o ADR 001 (core independente de DOM/Storage)
  e torna o core inutilizável na CLI. Rejeitada.
- **Fallback `Map<string, string>` dentro do core** — mistura responsabilidade e
  esconde a ausência de store; os sheets passariam a "funcionar" só em memória.
  Rejeitada (o fake é de teste, não de produção).
- **API síncrona** — impossível sobre OPFS. Rejeitada.

## Consequências

### Positivas

- Desacoplamento: o core não conhece OPFS, IndexedDB, `Deno.readTextFile` nem
  `node:fs`.
- Testes rápidos, herméticos e paralelos (fake em memória).
- A mesma pilha de sheets roda na CLI (Deno/Bun/Node) e na PWA.

### Negativas / Riscos

- Chamadas assíncronas propagam `Promise` por `SheetSender`/`SheetReceiver` —
  diferente do Ruby síncrono. Mitigação: os testes exercitam o caminho `await`.
- Um `FileStore` mal implementado pode engolir erros; o contrato exige que
  `read`/`write` rejeitem em falha.

### Neutras / Observações

- `KeyValueStore` existe para as Fases 19/20 (metadados, preferências) e não é
  consumido na Fase 18; é declarado junto por coesão do diretório `interfaces/`.
- Referências: ADR 001, ADR 003, ADR 010, ADR 027,
  `docs/syntaxmesh/fases/fase-18-time-status-sheets.md` §4.22.
