# Arquivos inicialmente suportados

O formato principal será inspirado no `.tjp`.

Exemplo:

```tjp
project "Minha Obra" {

    task "Fundação" {
        effort 10d
    }

    task "Estrutura" {
        depends "Fundação"
        effort 15d
    }
}
```

O objetivo inicial não será suportar imediatamente toda a gramática do TaskJuggler.

A implementação deverá evoluir progressivamente.

---

## Estratégia de compatibilidade com TaskJuggler

O TaskJuggler será utilizado como:

* referência conceitual;
* referência de sintaxe;
* referência de comportamento;
* fonte de exemplos;
* fonte para testes de compatibilidade.

Não será feita uma simples tradução mecânica:

```text
Ruby → TypeScript
```

A abordagem será:

```text
TaskJuggler
     │
     ├── documentação
     ├── exemplos
     ├── comportamento
     └── código-fonte
             │
             ▼
      Especificação
             │
             ▼
       SyntaxMesh
```

---

## Coexistência RichText e Markdown

O SyntaxMesh suporta dois formatos de markup para conteúdo:

### RichText (legado)

O formato RichText é usado em arquivos `.tjp` do TaskJuggler. O pacote `@syntaxmesh/richtext` implementa fielmente este formato para garantir compatibilidade com projetos existentes.

```text
project "Meu Projeto" {
    task "Tarefa 1" {
        description "Descrição em RichText **negrito** e //itálico//"
    }
}
```

### Markdown (going-forward)

O Markdown é o formato recomendado para novo conteúdo no SyntaxMesh. O pacote `@syntaxmesh/markdown` implementa a conversão e processamento deste formato.

```text
# Meu Projeto

## Tarefa 1

Descrição em Markdown **negrito** e *itálico*
```

### Conversão

Conversores entre RichText e Markdown serão implementados em fases futuras para facilitar a migração gradual de projetos legados.

| Formato | Pacote | Status | Uso |
|---|---|---|---|
| RichText | `@syntaxmesh/richtext` | Ativo (legado) | Arquivos `.tjp` existentes |
| Markdown | `@syntaxmesh/markdown` | Ativo (going-forward) | Novo conteúdo nativo |
