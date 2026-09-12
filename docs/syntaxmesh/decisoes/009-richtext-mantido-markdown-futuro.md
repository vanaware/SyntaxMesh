# RichText mantido, Markdown futuro

## Contexto

O formato de arquivo `.tjp` do TaskJuggler usa RichText (similar a MediaWiki markup) para descrições de tarefas, recursos e outros elementos. Durante a Fase 1, identificamos que o SyntaxMesh precisava suportar tanto o formato legado do TaskJuggler quanto um formato going-forward mais moderno.

## Decisão

Manter o RichText como formato legado para compatibilidade com arquivos `.tjp` existentes, enquanto introduz o Markdown como formato going-forward para conteúdo nativo do SyntaxMesh.

- `@syntaxmesh/richtext` implementa fielmente o RichText do TJ 3.8.4 para leitura e escrita de arquivos `.tjp`.
- `@syntaxmesh/markdown` (novo) é o formato going-forward para conteúdo nativo criado dentro do SyntaxMesh.
- Ambos coexistem no ecossistema. O RichText será depreciado lentamente em favor do Markdown para novos projetos.
- Conversores entre RichText e Markdown serão implementados em fases futuras para facilitar a migração.

## Consequências

### Positivas
- Compatibilidade total com arquivos `.tjp` existentes do TaskJuggler
- Uso de Markdown (formato amplamente conhecido) para novo conteúdo
- Separação clara entre preocupações de legado e inovação
- Comunidade já familiarizada com sintaxe Markdown

### Negativas / Riscos
- Duplicação de esforço em dois parsers de markup (RichText e Markdown)
- Necessidade de conversores para migração entre formatos
- Complexidade adicional na camada de armazenamento e exportação

### Neutras / Observações
- A decisão é um trade-off entre compatibilidade e modernidade
- O RichText será mantido indefinidamente para arquivos legado
- Novos projetos podem usar exclusivamente Markdown desde o início
- Esta decisão valida a criação dos pacotes `@syntaxmesh/richtext` e `@syntaxmesh/markdown` no ADR 009

---

**Status:** Aceito
**Data:** 2026-09-11
**Autor(es):** Vanaware