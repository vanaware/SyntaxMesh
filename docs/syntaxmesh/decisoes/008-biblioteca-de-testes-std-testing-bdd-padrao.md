# 008 — Biblioteca de testes padrão: `@std/testing/bdd`

## Contexto

O projeto possui múltiplos pacotes (`@syntaxmesh/core`, `@syntaxmesh/parser`, `@syntaxmesh/utils`, `@syntaxmesh/worker-db`, `@syntaxmesh/ui`, etc.) e cada um tinha um padrão de testes diferente:

- `packages/worker-db/tests/` → `Deno.test({ name, fn })` direto + `@std/assert`
- `packages/utils/tests/esbuild/` → `describe`/`it` de `@std/testing/bdd` + `@std/assert`

Esta inconsistência dificulta:

- Aprendizado de novos desenvolvedores
- Reuso de helpers e fixtures entre pacotes
- Manutenção de testes de forma consistente
- Integração com ferramentas de cobertura (ex: cobertura por teste)

**Alternativas consideradas:**

- A) Manter dois estilos (Deno.test direto e BDD) conforme o pacote
- B) Adotar `Deno.test()` direto como padrão em todos os pacotes
- C) Adotar `describe`/`it` de `@std/testing/bdd` como padrão em todos os pacotes

## Decisão

Adotado a alternativa **C**: **`@std/testing/bdd` é o padrão para todos os testes do projeto.**

Novos testes devem usar:

```ts
import { describe, it } from "@std/testing/bdd";
import { assertEquals, assert, assertNotEquals } from "@std/assert";

describe("myFeature", () => {
  it("deve fazer algo", () => {
    assertEquals(actual, expected);
  });
});
```

**Regras:**

- Todo teste novo usa `describe`/`it`
- Todo teste novo usa `@std/assert` para assertions
- `Deno.test()` direto é permitido apenas para migração gradual de pacotes antigos
- Não se deve misturar `Deno.test()` direto e `describe`/`it` no mesmo arquivo
- Helpers e fixtures devem ser escritos para funcionar com o padrão BDD

## Consequências

### Positivas
- Um único padrão para todos os pacotes
- Testes mais organizados por funcionalidade
- Melhor documentação automática (nomes dos testes)
- Facilita migração futura de pacotes antigos
- Alinha com convenções comuns de JavaScript/TypeScript

### Negativas / Riscos
- `packages/worker-db/tests/` ainda usam `Deno.test()` direto (migração gradual)
- `describe`/`it` adiciona uma camada extra de abstração
- Algumas pessoas preferem `Deno.test()` direto por ser mais simples

### Observações
- Documentado em `docs/syntaxmesh/06-testes-e-processo.md` (seção *Convenção de biblioteca de testes*)
- O padrão já está presente em `packages/utils/tests/esbuild/` e `packages/utils/tests/export/`

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)