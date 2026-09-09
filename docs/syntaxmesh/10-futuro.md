# Visão futura

O SyntaxMesh deverá evoluir para uma plataforma capaz de:

```text
              SyntaxMesh
                   │
       ┌───────────┼───────────┐
       │           │           │
       ▼           ▼           ▼
   Parser        Core       Reports
       │           │           │
       └───────────┼───────────┘
                   │
             Project Model
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
     Gantt      Dashboard    Export
```

Com possibilidade futura de:

* novos idiomas;
* tradução de arquivos;
* múltiplos calendários;
* cenários;
* planejamento de recursos;
* custos;
* receitas;
* análise financeira;
* dashboards;
* colaboração através de arquivos;
* integração com outros formatos;
* plugins;
* extensões da linguagem;
* grandes projetos;
* processamento em Web Worker.

---

# Filosofia do SyntaxMesh

O projeto deverá seguir quatro princípios:

## Simplicidade

Começar pequeno e crescer progressivamente.

## Independência

O motor não depende da interface ou de um servidor.

## Compatibilidade

Utilizar o TaskJuggler como referência de comportamento, sem ficar preso à implementação Ruby.

## Extensibilidade

A arquitetura deverá permitir que novas linguagens, relatórios e funcionalidades sejam adicionados sem modificar o Core.

---