# Gate de documentação (`lint:doc`) como ratchet

**Status:** Aceito
**Data:** 2026-11-08
**Fase:** transversal (pipeline de qualidade) — fecha o buraco deixado pelo
`lint:doc:all` desde `00dea6d`

## Contexto

O composite `deno task tests` termina em:

```
check:all → lint → fmt:check → lint:doc:all → check:doccore → test
```

`lint:doc:all` sempre foi `deno task --members lint:doc`, e **nenhum membro
define** `lint:doc`. Resultado: o composite abortava ali com
`error: Task not found`, e a validação completa só fechava rodando as outras
tasks uma a uma. Três saídas foram consideradas:

1. **Apagar `lint:doc:all` do composite** — resolve o vermelho apagando o
   medidor. Rejeitado.
2. **`deno doc --lint <entrada>` cru em cada membro** — mede, mas não passa:
   `packages/core/src/mod.ts` sozinho produz **1698** diagnósticos
   (1548 `missing-jsdoc`, 107 `private-type-ref`, 37 `missing-explicit-type`,
   6 `missing-return-type`). O barril do core reexporta o port inteiro, então
   todo símbolo herdado entra na conta.
3. **Extrator de blocos de código dos `.md` + `deno check`** — é o que a
   descrição antiga da task prometia, mas mede *outra coisa* (exemplos de docs,
   já cobertos por `manual-examples_test.ts` e pelos goldens) e não protege a
   API publicada.

O número 1698 não é lixo: são campos e métodos públicos do port sem JSDoc. Neste
projeto a documentação **de usuário** é o manual do `doc-core`
(`packages/core/src/docgen/`, Fase 22) e a sintaxe de referência gerada por ele;
JSDoc de símbolo interno é desejável, não obrigatório — documentar 1.548
símbolos herdados reescreveria o port. Por outro lado, deixar a contagem solta
permite que a superfície pública **piore** sem ninguém notar.

## Decisão

1. **`deno doc --lint` é o medidor**, executado por `scripts/lint-doc.ts` sobre
   as entradas do mapa `exports` de cada membro (`src/mod.ts src/docgen/mod.ts
   src/version.ts` no core, `.`/`./io`/`./options` na CLI, …). O tipo de
   verificação passa a ser o das **entradas publicadas**, não dos `.md`.

2. **O gate é um ratchet.** `scripts/lint-doc-baseline.json` guarda o teto de
   cada pacote por código de diagnóstico. Falha **acima** do teto; passar
   **abaixo** é permitido e o job sugere apertar
   (`deno task lint:doc:update:all`). Consequências práticas:
   - símbolo público novo sem JSDoc (ou com tipo privado na assinatura)
     **falha** — é o que o gate existe para pegar;
   - documentar dívida existente **nunca** quebra o build;
   - refatoração que só move símbolos não mexe na contagem.

3. **Entrada que não existe falha sempre.** Se o `deno doc` sai diferente de
   zero sem produzir diagnóstico reconhecido, o gate reporta "não mediu" e
   propaga o erro. Foi assim que os quatro `exports` mortos de
   `packages/service-worker` (`./handshakes/*` → `src/handshakes/`, removido
   numa refatoração anterior) apareceram: eles não são erro de tipo para
   `deno check`, mas são impossíveis de importar.

4. **Cada membro define `lint:doc` e `lint:doc:update`.** As entradas ficam
   explícitas na task, junto do `exports` que espelham; o script deriva o nome
   do pacote do `cwd`, então `deno task --members lint:doc` roda os cinco em
   paralelo, cada um no seu diretório.

5. **`server`, `ui` e `service-worker` ficam em piso zero** (não têm dívida) e
   **`cli` em 5** — só `private-type-ref`, tipos do core que a assinatura
   pública da CLI nomeia. Reexportá-los foi tentado e **piorou** (5 → 10):
   publicar `ExecutionRequest` faz o lint percorrer o grafo inteiro do envelope
   e cobrar público para cada membro. A CLI consome a API, não a republica.

## Alternativas rejeitadas

- **Reexportar os tipos do core na CLI/doc-core para zerar `private-type-ref`.**
  Testado: 5 → 10 diagnósticos, porque o grafo transitivo passa a contar. A
  dívida é real, mas o gate não é o lugar de resolvê-la.
- **Anotar o retorno de `buildCommand`.** O encadeamento do Cliffy carrega as
  flags no genérico: `Command` (base) não compila, `ReturnType<typeof
  commandDefinition>` vira um `private-type-ref` novo e um generic escrito à
  mão congela a lista de flags. O 1 `missing-return-type` fica no teto.
- **`missing-jsdoc` como aviso em vez de teto.** Deixaria a superfície pública
  crescer sem documentação e sem ninguém ver; o teto custa uma linha no JSON.
- **Documentar os 1.548 símbolos herdados antes de ligar o gate.** Bloquearia o
  composite por semanas e o manual do `doc-core` é a documentação oficial.
- **Teto por arquivo e por linha.** Precisão maior, mas qualquer renomeação ou
  movimentação exigiria reescrever o baseline; a contagem por pacote é o ponto
  de menor atrito que ainda pega o caso "símbolo novo sem doc".

## Consequências

### Positivas

- `deno task tests` fecha ponta a ponta (fim da exceção documentada em
  `CURRENT.md` desde `00dea6d`).
- A superfície pública dos cinco pacotes passa a ser medida no CI: adicionar
  export sem JSDoc quebra o build.
- Os `exports` mortos do `service-worker` foram removidos.
- A CLI caiu de 12 para 6 diagnósticos (JSDoc de `ParsedArgs.request`/
  `renderer`, do construtor de `CliUsageError` e dos três globais de
  `RuntimeGlobals`) e o `doc-core` de 12 para 9 (JSDoc dos três construtores).

### Negativas / Riscos

- **O teto do core é grande** (1698). Ele congela a dívida, não a paga: reduzir
  é trabalho incremental e o baseline precisa ser reescrito a cada avanço
  (uma task, sem edição manual).
- Um upgrade do Deno que mude a classificação de um diagnóstico falha o gate;
  a correção é deliberada (`lint:doc:update:all` + revisar o diff do baseline).
- A contagem é por pacote: é possível documentar um símbolo e deixar outro sem
  doc sem que o total suba. O gate é uma trava de regressão, não uma meta de
  cobertura.

### Neutras / Observações

- `scripts/lint-doc.ts` não tem teste próprio, como os outros gates
  (`check-stubs.ts`, `check-doccore.ts`): a verificação dele é a execução no
  composite. Os três caminhos (teto, estouro, entrada inexistente) foram
  exercitados à mão na entrega.
- `deno doc --lint` colore a saída mesmo com `stderr` em pipe; o script força
  `NO_COLOR=1` e descarta ANSI de qualquer forma.

---

**Status:** Aceito
**Data:** 2026-11-08
**Autor(es):** SyntaxMesh (port TS-only)
