# Fixtures do elemento `template` (Fase 23)

Elemento **TS-only** (ADR 033): não existe no TaskJuggler 3.8.4, portanto não há
oracle `tj3` para o que é expandido. A fonte de verdade é a especificação do
plano (`docs/syntaxmesh/fases/fase-23-template.md` §4–§6) mais os snapshots
determinísticos em `tests/golden/template.golden.json`.

Todo fixture aqui declara o projeto completo (cabeçalho + corpo) para rodar
sozinho via `parseProject(Deno.readTextFileSync(...))`.

| Fixture                  | Cobre                                                                                                                     | Consumido por                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `basic.tjp`              | declaração/registro (23.2), expansão em duas fases, `FOOTER` sem params, macro vizinha                                    | `template_golden_test.ts` (golden + registro)       |
| `args-matrix.tjp`        | todos os tipos de argumento nomeado do §4.2 (`string`/`number`/`bool`/`!id`/lista/objeto/aritmética) + `${?NOME}` ausente | `template_golden_test.ts`                           |
| `composition.tjp`        | `expandTemplate`, `expandTemplateList` + `for`, `project.name`, macro no corpo                                            | `template_golden_test.ts`                           |
| `macros-in-template.tjp` | Fase 1 (macro dentro do corpo) + macro com argumento posicional                                                           | `template_golden_test.ts`                           |
| `errors.tjp`             | um caso da tabela §5 (parâmetro obrigatório faltante)                                                                     | `template_golden_test.ts`                           |
| `lists-for.tjp`          | listas de strings/objetos/`!refs` como argumento + as três formas de `for` (23.10)                                        | `template_golden_test.ts`, `template-lists_test.ts` |
| `reports.tjp`            | template + `taskreport` consumido pela fachada `TaskJuggler.generateReports` (23.7.6)                                     | `integration/template-integration_23_test.ts`       |

## Regras de escrita

- **`template` segue a mesma condição da `macro` (23.9):** prolog (antes de
  `project`) ou nível de propriedades (depois do `}` do cabeçalho). Dentro do
  bloco `{ }` do projeto **não** é aceito — o parser responde
  `Unexpected token 'template' found.` exatamente como responderia para uma
  `macro` (regra do Ruby preservada; ver a auditoria 23.1b).
- Uma chamada `${NOME k=v …}` precisa caber em **uma linha**: o padrão do
  scanner é ancorado na linha corrente.
- `${NOME}` sem argumentos nomeados continua sendo resolvido pelo caminho de
  macro congelado — inclusive quando `NOME` é template.
- Corpos com `${MACRO}` exercitam a Fase 1; corpos com `{{ }}` exercitam a
  Fase 2 (Vento).
