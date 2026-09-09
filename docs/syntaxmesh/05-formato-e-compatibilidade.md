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
