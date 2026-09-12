# Port fiel do TaskJuggler

## Contexto

O SyntaxMesh é uma implementação independente inspirada no TaskJuggler 3.8.4. A decisão inicial era implementar com arquitetura própria. Após análise mais profunda, ficou claro que a fidelidade ao comportamento original é mais importante que a originalidade da arquitetura.

## Decisão

Portar **fielmente** o algoritmo, classes e semântica do TaskJuggler 3.8.4 do Ruby para TypeScript/Deno.

- Adaptações Ruby → TypeScript apenas quando a linguagem exigir (ex: `method_missing` → Proxy, blocos → funções de callback).
- Golden tests comparativos (`tj3` real vs `tj3-ts`) são o critério de aceite principal.
- Não inventar arquitetura nova onde o TJ já tem solução estabelecida.
- A estrutura de diretórios do Core espelha `lib/taskjuggler/` do TJ original.
- Nomes de classes e métodos permanecem em inglês (consistentes com o código fonte original).

## Consequências

### Positivas
- Comportamento idêntico ao TaskJuggler original
- Compatibilidade garantida com arquivos `.tjp` existentes
- Validação direta via golden tests
- Redução de riscos de bugs por divergência de comportamento

### Negativas / Riscos
- Limitação criativa para inovações arquiteturais
- Dependência de decisões de design do TJ original (mesmo que subótimas)
- Esforço adicional para mapear conceitos Ruby → TypeScript

### Neutras / Observações
- Esta decisão **substitui** o plano anterior de "implementação independente com arquitetura própria"
- A fidelidade é comportamental, não textual (não é um wrapper ou binding)
- O código fonte do TJ 3.8.4 (`docs/taskjuggler/`) é a principal referência
- A decisão não afeta a camada de UI, que pode ter sua própria arquitetura

---

**Status:** Aceito
**Data:** 2026-09-11
**Autor(es):** Qwen Code