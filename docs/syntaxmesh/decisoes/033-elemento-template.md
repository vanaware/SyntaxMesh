# Elemento `template` (Vento) como extensão de linguagem

**Status:** Aceito
**Data:** 2026-11-06
**Fase:** 23 (elemento estendido `template`); consumidores: 22 (grammar/help `lsp-core`), 24 (CLI)

## Contexto

O TaskJuggler 3.8.4 só possui **macros**: substituição textual com argumentos
posicionais (`${1}`, `${2}`) e fechamento do corpo por `]` no fim da linha
(`docs/taskjuggler/lib/taskjuggler/TextParser/MacroTable.rb`,
`parser/scanner.rb` l.450-464). Macros resolvem reutilização básica, mas não
oferecem **lógica de controle** — sem `if`, sem `for`, sem expressões —, o que
torna projetos grandes repetitivos e propensos a erro.

O port já porta as macros integralmente (Fase 10) e precisa de um mecanismo com
lógica **sem quebrar** um único `.tjp` legado: qualquer arquivo sem o novo
elemento tem de produzir exatamente o mesmo resultado de hoje.

Restrição de arquitetura que domina a decisão: o `Scanner` → FSM do `TextParser`
é **totalmente síncrono** (`nextToken()`, `ProjectFileParser#parse`), e o núcleo
não pode introduzir `await` no caminho de parse. A engine Vento 2.x, por sua
vez, compila todo template para uma função `async` (`Environment#compile`), o
que impede usá-la como está dentro do scanner.

## Decisão

1. **Novo elemento `template`**, keyword própria (i18n en/pt-BR/es), com a
   mesma delimitação de corpo das macros e com **lista de parâmetros nomeados**
   entre parênteses:

   ```
   template CARD [ task {{ id }} "{{ nome }}" { effort {{ esforco }} } ] (id, nome, esforco)
   ```

   O corpo continua sendo texto cru `[ … ]` fechado por `]` no fim da linha
   (regra da macro); os parâmetros vêm **depois** do `]`, na mesma linha, e são
   capturados pelo scanner (`ProjectFileScanner`) e entregues ao FSM no token
   `TEMPLATE`. Isso preserva **byte-a-byte** o caminho de macro: o regex de
   fechamento das macros (`.*\]\n`) não foi alterado — um `] (x)` em corpo de
   macro continua sendo corpo, como no Ruby.

2. **Vento sem autoescape.** `autoescape: false` é garantia documentada (§4.8 do
   plano): a saída é `.tjp`, não HTML. O filtro `escape` permanece disponível
   para quem quiser o comportamento oposto.

3. **Caminho síncrono de renderização.** `template-engine.ts` é o **único**
   módulo que importa `ventojs`. Ele compila com `env.compile()` (validação de
   sintaxe, `SourceError` com `position`) e executa o **código gerado pelo
   próprio Vento** convertendo apenas o cabeçalho `async function __template`
   em `function __template`. A conversão é segura porque o subconjunto de tags
   usadas na geração de `.tjp` (`{{ }}`, `if`, `for`, `set`, `echo`, pipes) não
   gera nenhum `await`; tags que dependem de I/O (`include`, `layout`,
   `for await`) são **rejeitadas com erro claro** (`template_async_tag`) quando
   um `await` aparece no código compilado. O resultado é byte-idêntico ao de
   `env.runString()` (verificado no spike e nos testes do wrapper).

   Alternativas descartadas: tornar o `Scanner`/FSM assíncrono (refatoração de
   todo o parser, impede uso síncrono na CLI e nos testes); pré-processar o
   arquivo inteiro antes do parse (duplicaria a coleta de macros/templates que
   o FSM já faz e perderia a reentrada de `${...}` no stream); reimplementar um
   mini-render próprio (perderia a engine especificada).

4. **Namespace único macro/template.** `MacroTable` guarda entradas tipadas
   (`kind: "macro" | "template"`), mantendo `get`/`add`/`includes`/`resolve`
   inalterados. Colisão é erro **na definição** com o tipo do primeiro
   registro — exceto **macro + macro**, que permanece o `warning`
   `marco_redefinition` do Ruby (regra zero: caminho de macro congelado).

5. **Expansão em duas fases no scanner**, no ponto `${...}` já existente
   (`Scanner#expandMacro`, ramo único de lookup):

   - **Fase 1** — expandir `${MACRO …}` dentro do corpo, com a mesma tabela e a
     mesma semântica da macro, sem tocar em `{{ }}`;
   - **Fase 2** — `renderTemplate(body, contexto)` com parâmetros nomeados,
     `project`, `ids`, `expandTemplate`, `expandMacro`, `expandTemplateList`.

   O texto resultante **reentra no stream** (`injectMacro`), como no caminho de
   macro: isso dá composição e reentrada de graça (um template pode emitir
   outra chamada `${…}`).

6. **Erros como mensagens** (`MessageHandler`), nunca `throw` no núcleo, sempre
   com o `SourceFileInfo` do `.tjp` **original** (definição ou chamada). Para
   erros de sintaxe/runtime do Vento, a `position` do erro é mapeada para a
   linha da definição + deslocamento no corpo.

7. **Recursão é erro com cadeia**, não stack overflow: as chamadas de template
   entram na mesma pilha de expansão do scanner (`MacroStackEntry` estendido),
   então `${CARD}` dentro de `CARD` e `expandTemplate("A")` em `A` produzem
   `recursão detectada: CARD → CARD` / `A → B → A`.

8. **Golden TS-only.** `template` não existe no Ruby: a fidelidade é contra o
   plano (§4-§6) e a semântica do Vento, com snapshot determinístico em
   `packages/core/tests/golden/template.golden.json` gerado por script TS
   próprio (política de extensões, `scripts/golden/README.md`). Nenhum oracle
   `tj3` participa.

## Consequências

### Positivas

- Lógica real (`if`/`for`/`set`/pipes/expressões) sem quebrar nenhum `.tjp`
  existente: arquivo sem `template` produz o mesmo resultado de hoje.
- Migração incremental: macros continuam funcionando **dentro** de templates, e
  templates podem chamar macros (`expandMacro`) e outros templates.
- Uma única dependência nova, confinada a um arquivo, com versão fixada no
  `imports` do `packages/core/deno.jsonc` (sem `node_modules` versionado).
- Erros localizados no `.tjp` original, o que mantém a usabilidade das macros.

### Negativas / Riscos

- **`new Function`**: o Vento compila templates com `new Function` (e o caminho
  síncrono reusa esse código gerado). Isso exige `unsafe-eval` em CSP — condição
  que o Vento já impõe por si; a PWA deve liberar `unsafe-eval` (Fase 20) e o
  template é conteúdo do próprio autor do `.tjp`, não entrada de terceiros.
- **Sem `include`/`layout`**: tags que dependem de I/O assíncrono são rejeitadas.
  A inclusão de arquivos continua sendo responsabilidade do `include` do TJP,
  o que é coerente com o modelo.
- Chamadas de template com argumentos nomeados precisam estar **em uma linha**
  (o modo `:macroCall` multilinha do Ruby só conhece argumentos citados).
- Divergência registrada: por reentrada de stream, `${TEMPLATE …}` escrito
  dentro de um corpo de **macro** acaba expandindo quando o texto da macro
  reentra no scanner. O caminho de macro não foi alterado (regra zero); o
  comportamento é documentado e coberto por teste de guarda em 23.5.5.

### Neutras / Observações

- `ids("t1")` devolve a referência textual `!t1` (sem validar o ID): a expansão
  acontece **antes** do modelo existir, então validação de ID é do parser.
- `project` é uma view rasa e somente leitura (`name`, `start`, `end`, `now`,
  `currency`, …) montada pelo parser no momento da expansão.
- `MacroTable` cresce em responsabilidade, mas o contrato público de macro
  permanece idêntico — a suíte da Fase 10 é o teste de regressão.

---

## Emenda 1 (2026-11-07) — colocação: mesma condição da `macro`

A primeira implementação aceitava `template` também dentro do bloco `{ }` do
cabeçalho do projeto (`projectBodyAttributes`), posição em que a `macro`
**nunca** foi aceita — no Ruby, `rule_projectProlog`
(`lib/taskjuggler/TextParser/TjpSyntaxRules.rb:3486`) lista apenas
`!prologInclude` e `!macro`. A assimetria era acidental e foi removida:

- `!template` **saiu** de `projectBodyAttributes`;
- permanece em `projectProlog` (antes de `project`) e em `propertiesBody`
  (nível de propriedades, depois do `}`);
- `reportPropertiesBody` ganhou `!template` ao lado de `!macro`, já que o
  namespace é único.

Dentro do `{ }` as duas palavras agora falham com a **mesma** sequência de
mensagens (`no_reduce`, `no_reduce`, `unexpctd_token`), provado em
`tests/parser/template-decl_test.ts` (describe "colocação (23.9)").

---

**Status:** Aceito
**Data:** 2026-11-06
**Autor(es):** SyntaxMesh (port TS-only)
