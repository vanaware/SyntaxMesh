# 1. Visão do projeto

O **SyntaxMesh** é um motor de planejamento e gerenciamento de projetos inspirado nos conceitos e na linguagem do TaskJuggler, porém desenvolvido do zero em **TypeScript**, com execução no navegador e sem necessidade de servidor de aplicação.

O sistema deverá ser capaz de:

* interpretar arquivos de planejamento;
* calcular cronogramas;
* resolver dependências;
* trabalhar com recursos;
* calcular esforço, duração e custos;
* gerar relatórios;
* gerar gráficos de Gantt;
* trabalhar offline;
* armazenar projetos localmente;
* funcionar como PWA;
* permitir edição de arquivos de projeto;
* utilizar IndexedDB e OPFS;
* funcionar em hospedagem estática;
* oferecer uma linguagem de projeto multilíngue.

O objetivo não é simplesmente converter o código Ruby do TaskJuggler para TypeScript.

O objetivo é criar uma **implementação independente**, compatível conceitualmente com o modelo de planejamento do TaskJuggler, utilizando seu comportamento, documentação e exemplos como referência.

---

# 26. Definição final do projeto

**SyntaxMesh** será:

> Um motor de planejamento de projetos offline, executado integralmente no navegador, escrito em TypeScript e desenvolvido com Deno, capaz de interpretar uma linguagem de planejamento inspirada no TaskJuggler, com sintaxe multilíngue, motor próprio de scheduling, recursos, custos, calendários, relatórios e gráficos de Gantt, funcionando como uma PWA sem necessidade de servidor de aplicação.

A arquitetura central será:

```text
                 ┌─────────────────────┐
                 │      SyntaxMesh      │
                 └──────────┬──────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
       Parser              Core            Report
          │                 │                 │
   ┌──────┼──────┐          │                 │
   ▼      ▼      ▼          │                 │
 English  PT-BR  Español     │                 │
   │      │      │           │                 │
   └──────┼──────┘           │                 │
          ▼                  │                 │
      Canonical AST ─────────┘                 │
                            │                  │
                            ▼                  │
                       Scheduler ──────────────┘
                            │
                            ▼
                         Storage
                            │
                    ┌───────┴───────┐
                    ▼               ▼
                IndexedDB          OPFS
                    │
                    ▼
                  PWA
                    │
                    ▼
                 Browser
```

**Nome oficial do projeto: SyntaxMesh.**

**Objetivo:** construir primeiro um motor sólido e testável; depois uma aplicação completa em cima dele.
