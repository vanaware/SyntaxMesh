# SyntaxMesh

## Offline Multilingual Project Planning Engine

**Versão do documento:** 1.0
**Status:** Especificação-base para desenvolvimento
**Tecnologia principal:** TypeScript + Deno + Web APIs
**Execução:** 100% offline no navegador
**Modelo:** PWA / Static Web Application

---

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

# 2. Princípios fundamentais

O desenvolvimento deverá obedecer às seguintes regras.

## 2.1 TypeScript + Deno

O projeto será desenvolvido exclusivamente com:

* TypeScript;
* Deno;
* Web APIs;
* HTML;
* CSS;
* Preact;
* Signals;
* BeerCSS.

Não utilizar:

* Node.js;
* npm;
* yarn;
* pnpm;
* package.json;
* node_modules;
* dependências que exijam Node para execução.

O Deno será utilizado como:

* ambiente de desenvolvimento;
* executor TypeScript;
* executor de testes;
* lint;
* formatter;
* tarefas de build;
* ferramentas auxiliares.

---

# 3. Execução offline

O SyntaxMesh deverá funcionar completamente sem servidor de aplicação.

Arquitetura:

```text
                  Navegador
                     │
              ┌──────▼──────┐
              │ SyntaxMesh  │
              │    PWA      │
              └──────┬──────┘
                     │
       ┌─────────────┼─────────────┐
       │             │             │
       ▼             ▼             ▼
   IndexedDB       OPFS        Cache API
       │             │             │
       └─────────────┼─────────────┘
                     │
                  Offline
```

O servidor de hospedagem terá apenas a função de entregar arquivos estáticos.

Não deverá existir:

```text
Browser → Application Server → Database
```

A arquitetura desejada é:

```text
Browser
   │
   ├── Application
   ├── Core
   ├── Parser
   ├── Reports
   ├── IndexedDB
   ├── OPFS
   └── Service Worker
```

---

# 4. Arquitetura geral

A arquitetura principal será:

```text
SyntaxMesh
│
├── core
├── parser
├── report
├── storage
└── app
```

## 4.1 Core

Responsável pelo modelo e processamento do planejamento.

Não poderá depender de:

* Preact;
* BeerCSS;
* DOM;
* window;
* document;
* IndexedDB;
* OPFS;
* Service Worker.

O Core deverá ser executável em:

* navegador;
* Web Worker;
* Deno;
* testes automatizados.

---

## 4.2 Parser

Responsável por:

* lexer;
* tokens;
* gramática;
* AST;
* análise semântica;
* validação;
* linguagem;
* tradução de palavras-chave para uma representação canônica.

---

## 4.3 Report

Responsável por:

* modelo de relatório;
* filtros;
* colunas;
* agrupamentos;
* Gantt;
* HTML;
* CSV;
* JSON;
* futuras formas de exportação.

---

## 4.4 Storage

Responsável por persistência local:

* IndexedDB;
* OPFS;
* arquivos;
* projetos;
* configurações;
* importação;
* exportação.

---

## 4.5 App

Responsável pela interface.

Tecnologias:

* Preact;
* Signals;
* BeerCSS;
* Web APIs.

---

# 5. Estrutura de diretórios

Estrutura inicial proposta:

```text
syntaxmesh/
│
├── deno.json
├── README.md
├── LICENSE
│
├── src/
│   │
│   ├── core/
│   │   ├── model/
│   │   ├── calendar/
│   │   ├── scheduling/
│   │   ├── accounting/
│   │   ├── resources/
│   │   ├── scenarios/
│   │   ├── expressions/
│   │   └── validation/
│   │
│   ├── parser/
│   │   ├── lexer/
│   │   ├── grammar/
│   │   ├── ast/
│   │   ├── parser/
│   │   ├── semantic/
│   │   └── language/
│   │       ├── language.ts
│   │       ├── english.ts
│   │       ├── portuguese-br.ts
│   │       └── spanish.ts
│   │
│   ├── report/
│   │   ├── model/
│   │   ├── filters/
│   │   ├── columns/
│   │   ├── gantt/
│   │   ├── html/
│   │   ├── csv/
│   │   └── json/
│   │
│   ├── storage/
│   │   ├── indexeddb/
│   │   ├── opfs/
│   │   └── projects/
│   │
│   └── app/
│       ├── components/
│       ├── signals/
│       ├── views/
│       ├── workers/
│       └── main.tsx
│
├── tests/
│   ├── core/
│   ├── parser/
│   ├── report/
│   ├── storage/
│   └── integration/
│
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
│
└── examples/
    ├── minimal.tjp
    └── tutorial.tjp
```

---

# 6. Sintaxe multilíngue

Uma das características fundamentais do SyntaxMesh será permitir que a linguagem dos arquivos de projeto seja escolhida pelo usuário.

Inicialmente serão previstas:

* English;
* Português do Brasil;
* Español.

A arquitetura deverá permitir adicionar outros idiomas futuramente.

---

# 7. Idioma do projeto x idioma da interface

Esses dois conceitos devem permanecer separados.

```text
Project Language != Application UI Language
```

Por exemplo:

Um usuário pode utilizar a interface em português e abrir um projeto escrito em inglês:

```text
UI: Português
Projeto: English
```

Ou:

```text
UI: English
Projeto: Português
```

O idioma da interface não deverá alterar automaticamente o idioma do arquivo de projeto.

---

# 8. Arquitetura da linguagem

O fluxo será:

```text
                 SyntaxMesh
                     │
              ┌──────▼──────┐
              │ Language    │
              │ Dictionary  │
              └──────┬──────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
     English     Português      Español
        │            │            │
        └────────────┼────────────┘
                     ▼
                  Lexer
                     │
                     ▼
                  Parser
                     │
                     ▼
                    AST
                     │
                     ▼
                   Core
```

O Core não deverá conhecer idiomas.

---

# 9. Representação canônica

Os idiomas serão convertidos para uma representação interna única.

Por exemplo:

```text
task
tarefa
tarea
```

deverão resultar no mesmo conceito:

```ts
{
    type: "Task"
}
```

Da mesma forma:

```text
project
projeto
proyecto
```

deverão produzir:

```ts
{
    type: "Project"
}
```

Isso evita que o Core tenha que conhecer cada idioma.

---

# 10. LanguageDefinition

A arquitetura deverá possuir uma definição semelhante a:

```ts
interface LanguageDefinition {
    id: string;
    name: string;

    keywords: Record<string, string[]>;

    units: Record<string, string[]>;
}
```

Exemplo:

```ts
const english: LanguageDefinition = {
    id: "en",
    name: "English",

    keywords: {
        project: ["project"],
        task: ["task"],
        resource: ["resource"],
        depends: ["depends"],
        effort: ["effort"],
        duration: ["duration"],
        report: ["report"]
    },

    units: {
        day: ["d", "day", "days"],
        hour: ["h", "hour", "hours"]
    }
};
```

Português:

```ts
const portugueseBR: LanguageDefinition = {
    id: "pt-BR",
    name: "Português (Brasil)",

    keywords: {
        project: ["projeto"],
        task: ["tarefa"],
        resource: ["recurso"],
        depends: ["depende"],
        effort: ["esforço"],
        duration: ["duração"],
        report: ["relatório"]
    },

    units: {
        day: ["d", "dia", "dias"],
        hour: ["h", "hora", "horas"]
    }
};
```

A implementação real deverá ser refinada durante a fase do parser.

---

# 11. Declaração do idioma no arquivo

A linguagem poderá ser explicitamente definida:

```tjp
language "pt-BR"

projeto "Minha Obra" {
    tarefa "Fundação" {
        esforço 10d
    }
}
```

Em inglês:

```tjp
language "en"

project "My Project" {
    task "Foundation" {
        effort 10d
    }
}
```

A diretiva `language` deverá ser tratada pelo parser antes da interpretação das demais palavras-chave.

---

# 12. Compatibilidade e tradução

O projeto deverá considerar futuramente a possibilidade de traduzir:

```text
Português → English
English → Português
English → Español
```

Entretanto, isso não será requisito obrigatório da primeira versão do parser.

A prioridade inicial será:

```text
English
      ↓
Canonical AST
      ↑
Português
      ↑
Español
```

---

# 13. Arquivos inicialmente suportados

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

# 14. Estratégia de compatibilidade com TaskJuggler

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

# 15. Estratégia de testes

Toda funcionalidade deverá possuir testes.

Regra:

```text
Implementar
    ↓
Criar teste
    ↓
Executar teste
    ↓
Corrigir
    ↓
Formatar
    ↓
Lint
    ↓
Commit
    ↓
Próxima tarefa
```

Comandos principais:

```bash
deno test
deno lint
deno fmt --check
```

Durante desenvolvimento:

```bash
deno fmt
deno lint
deno test
```

---

# 16. Regra de desenvolvimento incremental

Não implementar grandes blocos de código de uma única vez.

Cada fase deverá ser dividida em pequenas tarefas.

Cada tarefa deverá:

1. possuir objetivo claro;
2. modificar o mínimo necessário;
3. possuir testes;
4. passar nos testes;
5. passar no lint;
6. estar formatada;
7. deixar o projeto em estado funcional.

---

# 17. Plano geral

O desenvolvimento será dividido em oito fases:

```text
FASE 1  Fundação
   ↓
FASE 2  Core
   ↓
FASE 3  Parser + Linguagem
   ↓
FASE 4  Reports
   ↓
FASE 5  Storage
   ↓
FASE 6  PWA
   ↓
FASE 7  Interface
   ↓
FASE 8  Compatibilidade e Qualidade
```

---

# FASE 1 — FUNDAÇÃO

## Objetivo

Criar a base técnica do projeto.

### TODO 1.1 — Criar projeto Deno

Criar:

```text
deno.json
```

Configurar:

* TypeScript;
* imports;
* tasks;
* lint;
* formatter;
* testes.

### Testes

Verificar que:

```bash
deno test
deno lint
deno fmt --check
```

funcionam em um projeto vazio.

---

## TODO 1.2 — Estrutura de diretórios

Criar:

```text
src/
tests/
examples/
public/
```

e os módulos:

```text
core/
parser/
report/
storage/
app/
```

### Teste

Criar pelo menos um teste de sanidade.

---

## TODO 1.3 — Core independente

Criar um primeiro módulo do Core.

Exemplo:

```ts
export interface Project {
    name: string;
}
```

### Teste

Criar projeto em memória e verificar seus dados.

---

## TODO 1.4 — Pipeline de qualidade

Configurar:

* formatter;
* lint;
* test;
* tasks Deno.

### Critério

Nenhum warning ou erro.

---

## TODO 1.5 — Documentação inicial

Criar:

```text
README.md
LICENSE
```

Documentar:

* objetivo;
* arquitetura;
* instalação;
* execução;
* testes;
* princípios do projeto.

---

# FASE 2 — CORE

## Objetivo

Construir o motor de planejamento sem interface.

---

## TODO 2.1 — Modelo de projeto

Criar entidades:

```text
Project
Task
Resource
Account
Scenario
Calendar
```

Testar criação e validação.

---

## TODO 2.2 — Hierarquia de tarefas

Suportar:

```text
Project
 ├── Task A
 ├── Task B
 │    ├── Task B1
 │    └── Task B2
 └── Task C
```

Testar:

* pai;
* filho;
* profundidade;
* identificação;
* caminho.

---

## TODO 2.3 — Duração

Implementar:

* horas;
* dias;
* semanas;
* meses, quando aplicável;
* duração zero;
* duração inválida.

Criar testes de conversão.

---

## TODO 2.4 — Esforço

Implementar:

```text
effort
```

e sua representação interna.

Testar:

```text
10h
1d
5d
```

---

## TODO 2.5 — Calendários

Implementar:

* dias úteis;
* finais de semana;
* feriados;
* horários de trabalho;
* calendário padrão;
* calendários personalizados.

Testar cálculo de datas.

---

## TODO 2.6 — Dependências

Implementar relações entre tarefas.

Inicialmente:

```text
A → B
```

onde B depende de A.

Posteriormente:

* finish-to-start;
* start-to-start;
* finish-to-finish;
* start-to-finish, se necessário.

Testar todos os tipos suportados.

---

## TODO 2.7 — Scheduler

Criar o primeiro algoritmo de agendamento.

Entrada:

```text
tasks
dependencies
calendar
effort/duration
```

Saída:

```text
start
end
```

Testar cronogramas simples.

---

## TODO 2.8 — Detecção de ciclos

Detectar:

```text
A → B
B → C
C → A
```

Retornar erro sem entrar em loop infinito.

---

## TODO 2.9 — Recursos

Criar:

```text
Resource
ResourceAssignment
```

Implementar:

* disponibilidade;
* capacidade;
* alocação;
* conflitos básicos.

---

## TODO 2.10 — Custos

Implementar:

* custo por recurso;
* custo da tarefa;
* custo acumulado;
* custo do projeto.

---

## TODO 2.11 — Receitas

Preparar suporte para:

* revenue;
* custo;
* lucro;
* margem.

---

## TODO 2.12 — Restrições

Criar modelo para:

* início mínimo;
* término máximo;
* datas fixas;
* deadlines;
* restrições de calendário.

---

## TODO 2.13 — Cenários

Criar estrutura para cenários:

```text
Base
Optimistic
Pessimistic
```

ou equivalente.

O modelo deverá permitir futuramente comparar cronogramas.

---

## TODO 2.14 — Expressões

Criar infraestrutura para expressões utilizadas pelo formato.

Exemplo conceitual:

```text
cost * 1.1
```

Não é necessário implementar toda a linguagem de expressões nesta tarefa.

---

## TODO 2.15 — Validação

Criar sistema centralizado de erros:

```ts
ValidationError
SchedulingError
DependencyError
ResourceError
```

---

## TODO 2.16 — Testes do Core

Criar uma suíte ampla cobrindo:

* projetos;
* tarefas;
* hierarquia;
* calendário;
* duração;
* esforço;
* dependências;
* scheduler;
* recursos;
* custos;
* restrições;
* cenários;
* expressões.

---

# FASE 3 — PARSER + MULTILINGUAL

## Objetivo

Criar o compilador/interpreter dos arquivos SyntaxMesh.

Pipeline:

```text
Source
  ↓
Lexer
  ↓
Tokens
  ↓
Parser
  ↓
AST
  ↓
Semantic Analysis
  ↓
Core Model
```

---

# TODO 3.1 — Lexer

Criar tokens para:

* identificadores;
* strings;
* números;
* unidades;
* operadores;
* chaves;
* parênteses;
* comentários;
* palavras-chave.

---

# TODO 3.2 — Testes do Lexer

Exemplo:

```text
task "Foundation"
```

deverá produzir tokens previsíveis.

Testar cada categoria.

---

# TODO 3.3 — AST

Criar representação intermediária.

Exemplo:

```ts
interface TaskNode {
    type: "Task";
    name: string;
}
```

---

# TODO 3.4 — Parser mínimo

Implementar:

```tjp
project "Test" {
    task "A"
}
```

Gerar AST.

---

# TODO 3.5 — Parser de esforço

Suportar:

```tjp
effort 10d
```

---

# TODO 3.6 — Parser de dependências

Suportar:

```tjp
depends "A"
```

---

# TODO 3.7 — Análise semântica

Validar:

* tarefas inexistentes;
* dependências inválidas;
* nomes duplicados;
* tipos inválidos;
* recursos inexistentes;
* ciclos.

---

# TODO 3.8 — Sistema de idiomas

Criar:

```text
src/parser/language/
```

com:

```text
language.ts
english.ts
portuguese-br.ts
spanish.ts
```

---

# TODO 3.9 — Registro de idiomas

Criar um registry:

```ts
LanguageRegistry
```

permitindo:

```ts
registry.get("en");
registry.get("pt-BR");
registry.get("es");
```

---

# TODO 3.10 — Keywords canônicas

Definir um vocabulário interno.

Exemplo:

```text
project
task
resource
depends
effort
duration
report
```

Os idiomas deverão mapear para esses conceitos.

---

# TODO 3.11 — Português

Implementar primeira versão:

```text
project → projeto
task → tarefa
resource → recurso
depends → depende
effort → esforço
duration → duração
report → relatório
```

---

# TODO 3.12 — Español

Implementar equivalente em espanhol.

---

# TODO 3.13 — Diretiva language

Implementar:

```tjp
language "pt-BR"
```

e:

```tjp
language "en"
```

---

# TODO 3.14 — Validação de idioma

Detectar:

* idioma inexistente;
* idioma duplicado;
* linguagem incompatível;
* keyword desconhecida.

---

# TODO 3.15 — AST equivalente entre idiomas

Este será um teste fundamental.

Os três arquivos:

```tjp
project "X" {
    task "A"
}
```

```tjp
projeto "X" {
    tarefa "A"
}
```

```tjp
proyecto "X" {
    tarea "A"
}
```

deverão produzir ASTs semanticamente equivalentes.

---

# TODO 3.16 — Testes multilíngues

Criar testes comparando:

```text
English AST
Portuguese AST
Spanish AST
```

e garantir equivalência.

---

# TODO 3.17 — Integração Parser → Core

Converter:

```text
Source
→ AST
→ Core Model
→ Scheduler
```

e testar o resultado completo.

---

# FASE 4 — REPORT

## Objetivo

Criar o sistema de relatórios independente da UI.

---

# TODO 4.1 — Report Model

Criar:

```text
Report
Column
Row
Cell
Filter
Grouping
```

---

# TODO 4.2 — Relatório de tarefas

Mostrar:

* ID;
* nome;
* início;
* término;
* duração;
* esforço;
* custo.

---

# TODO 4.3 — Filtros

Implementar filtros por:

* tarefa;
* recurso;
* período;
* status;
* hierarquia.

---

# TODO 4.4 — Colunas

Permitir definir colunas dinamicamente.

---

# TODO 4.5 — Agrupamento

Suportar agrupamento hierárquico.

---

# TODO 4.6 — Gantt

Criar motor de Gantt.

Inicialmente gerar SVG.

Deverá representar:

* tarefas;
* dependências;
* datas;
* marcos;
* hierarquia.

---

# TODO 4.7 — Exportação JSON

Exportar relatórios em JSON.

---

# TODO 4.8 — Exportação CSV

Exportar dados tabulares em CSV.

---

# TODO 4.9 — HTML

Gerar HTML independente da aplicação.

---

# TODO 4.10 — Testes de reports

Validar:

* conteúdo;
* ordenação;
* filtros;
* colunas;
* Gantt;
* JSON;
* CSV;
* HTML.

---

# FASE 5 — STORAGE

## Objetivo

Implementar persistência totalmente local.

---

# TODO 5.1 — IndexedDB

Criar camada de abstração:

```text
ProjectRepository
```

Não deixar o restante da aplicação depender diretamente da API do IndexedDB.

---

# TODO 5.2 — CRUD de projetos

Implementar:

```text
create
read
update
delete
list
```

---

# TODO 5.3 — OPFS

Utilizar OPFS para arquivos do projeto.

Suportar:

```text
.tjp
```

e arquivos relacionados.

---

# TODO 5.4 — Importação

Permitir importar:

```text
.tjp
```

---

# TODO 5.5 — Exportação

Permitir exportar arquivos.

---

# TODO 5.6 — Autosave

Criar mecanismo de salvamento automático.

---

# TODO 5.7 — Recuperação

Implementar recuperação de projeto após:

* fechamento;
* reload;
* perda de conexão;
* interrupção inesperada.

---

# TODO 5.8 — Testes de storage

Testar:

* CRUD;
* persistência;
* importação;
* exportação;
* recuperação.

---

# FASE 6 — PWA

## Objetivo

Transformar o sistema em aplicação instalável e offline.

---

# TODO 6.1 — Manifest

Criar:

```text
manifest.json
```

Definir:

* nome;
* short_name;
* ícones;
* display;
* start_url;
* theme;
* background.

---

# TODO 6.2 — Service Worker

Criar:

```text
sw.js
```

Implementar cache dos recursos necessários.

---

# TODO 6.3 — Offline

Garantir que depois do primeiro carregamento:

```text
Internet = não necessária
```

---

# TODO 6.4 — Atualização

Criar estratégia para:

* detectar nova versão;
* atualizar cache;
* evitar versões parcialmente misturadas.

---

# TODO 6.5 — Web Worker

Avaliar execução do Core/Scheduler em Worker.

Objetivo:

```text
UI
 │
 ▼
Worker
 │
 ├── Parser
 ├── Core
 └── Scheduler
```

Isso permitirá manter a interface responsiva em projetos grandes.

---

# TODO 6.6 — Testes PWA

Testar:

* instalação;
* carregamento offline;
* cache;
* atualização;
* worker.

---

# FASE 7 — INTERFACE

## Objetivo

Criar a aplicação visual.

Tecnologias:

```text
Preact
Signals
BeerCSS
```

---

# TODO 7.1 — Shell da aplicação

Criar:

* layout;
* navegação;
* área principal;
* barra de ferramentas;
* status.

---

# TODO 7.2 — Project Explorer

Criar árvore:

```text
Projetos
 ├── Projeto A
 ├── Projeto B
 └── Projeto C
```

---

# TODO 7.3 — Editor

Criar editor para arquivos `.tjp`.

---

# TODO 7.4 — Feedback do parser

Mostrar:

* erros;
* warnings;
* linha;
* coluna;
* mensagem.

---

# TODO 7.5 — Signals

Criar estado reativo para:

* projeto atual;
* arquivo atual;
* idioma;
* erros;
* seleção;
* relatório;
* preferências.

---

# TODO 7.6 — Editor + Scheduler

Quando o arquivo for alterado:

```text
Editor
  ↓
Parser
  ↓
Semantic Analysis
  ↓
Core
  ↓
Scheduler
  ↓
Report
```

---

# TODO 7.7 — Gantt visual

Integrar o Gantt SVG ao aplicativo.

---

# TODO 7.8 — Relatórios

Criar interface para:

* selecionar relatório;
* filtros;
* colunas;
* exportação.

---

# TODO 7.9 — Seleção do idioma da interface

Permitir:

```text
Português
English
Español
```

independentemente do idioma do projeto.

---

# TODO 7.10 — Seleção do idioma do projeto

Permitir definir:

```text
English
Português (Brasil)
Español
```

---

# TODO 7.11 — Tema

Seguir inicialmente:

```css
prefers-color-scheme
```

Não criar inicialmente um toggle próprio de tema.

---

# TODO 7.12 — Responsividade

Garantir funcionamento em:

* desktop;
* tablet;
* celular.

---

# FASE 8 — COMPATIBILIDADE E QUALIDADE

## Objetivo

Aproximar o comportamento do SyntaxMesh do modelo do TaskJuggler e preparar uma versão robusta.

---

# TODO 8.1 — Corpus de exemplos

Criar coleção de arquivos de teste.

```text
examples/
tests/fixtures/
```

---

# TODO 8.2 — Testes de compatibilidade

Para cada exemplo:

```text
Input
 ↓
SyntaxMesh
 ↓
AST
 ↓
Schedule
 ↓
Report
```

validar resultados esperados.

---

# TODO 8.3 — Golden tests

Criar arquivos contendo:

```text
input
expected AST
expected schedule
expected report
```

---

# TODO 8.4 — Conformidade multilíngue

Cada exemplo importante deverá possuir versões:

```text
example.en.tjp
example.pt-BR.tjp
example.es.tjp
```

Os resultados deverão ser equivalentes.

---

# TODO 8.5 — Performance

Criar benchmarks para:

* lexer;
* parser;
* scheduler;
* relatórios;
* Gantt.

Testar projetos:

```text
100 tarefas
1.000 tarefas
10.000 tarefas
```

quando possível.

---

# TODO 8.6 — Segurança

Validar:

* arquivos malformados;
* expressões maliciosas;
* loops;
* consumo excessivo de memória;
* entrada muito grande;
* HTML gerado;
* SVG;
* nomes contendo HTML/JS.

Nunca executar conteúdo do arquivo como JavaScript.

---

# TODO 8.7 — Testes de regressão

Toda correção de bug deverá resultar em um novo teste.

Regra:

```text
Bug
 ↓
Regression Test
 ↓
Fix
```

---

# TODO 8.8 — Testes cross-browser

Avaliar:

* Chrome;
* Edge;
* Firefox;
* Safari.

Principalmente:

* IndexedDB;
* OPFS;
* Service Worker;
* Web Workers;
* Speech/Web APIs quando utilizadas.

---

# TODO 8.9 — Build de produção

Criar processo:

```text
Deno
 ↓
TypeScript
 ↓
Bundle
 ↓
Static Files
 ↓
Hosting
```

Sem Node/npm.

---

# TODO 8.10 — Release

Definir:

* versionamento;
* changelog;
* documentação;
* exemplos;
* testes;
* build final.

---

# 18. Roadmap resumido

```text
                    SYNTAXMESH
                        │
        ┌───────────────┴────────────────┐
        │                                │
     ENGINE                           APP
        │                                │
        ▼                                ▼
     FASE 1                           FASE 6
     Fundação                         PWA
        │                                │
        ▼                                ▼
     FASE 2                           FASE 7
     Core                              UI
        │
        ▼
     FASE 3
     Parser
     Multilingual
        │
        ▼
     FASE 4
     Reports
        │
        ▼
     FASE 5
     Storage
        │
        └───────────────┐
                        ▼
                     FASE 8
              Compatibilidade
                e Qualidade
```

---

# 19. Ordem de prioridade

A prioridade será:

## Prioridade 1

```text
Foundation
Core
Parser
```

Sem interface.

---

## Prioridade 2

```text
Scheduler
Reports
```

---

## Prioridade 3

```text
Storage
PWA
```

---

## Prioridade 4

```text
UI
```

---

## Prioridade 5

```text
TaskJuggler compatibility
Performance
Security
```

---

# 20. MVP

O primeiro MVP deverá ser pequeno.

Objetivo:

```text
arquivo .tjp
      ↓
parser
      ↓
AST
      ↓
Core
      ↓
scheduler
      ↓
Gantt
```

Exemplo mínimo:

```tjp
language "pt-BR"

projeto "Minha Obra" {

    tarefa "Fundação" {
        esforço 10d
    }

    tarefa "Estrutura" {
        depende "Fundação"
        esforço 15d
    }
}
```

O sistema deverá:

1. ler o arquivo;
2. reconhecer português;
3. construir AST;
4. criar tarefas;
5. resolver dependência;
6. calcular datas;
7. gerar relatório;
8. gerar Gantt.

Depois disso, adicionar inglês e espanhol.

---

# 21. Critério de conclusão de cada fase

Uma fase não será considerada concluída apenas porque o código funciona.

Ela deverá possuir:

```text
Código
+
Testes
+
Documentação
+
Lint
+
Formatter
+
Integração
```

Critério:

```bash
deno test
deno lint
deno fmt --check
```

sem erros.

---

# 22. Regra para a IA que irá desenvolver o projeto

A IA deverá seguir estas regras:

### Regra 1

Não implementar várias tarefas simultaneamente.

### Regra 2

Executar uma tarefa pequena por vez.

### Regra 3

Depois de cada implementação:

```text
test
→ fix
→ lint
→ format
```

### Regra 4

Não introduzir Node.js.

### Regra 5

Não introduzir npm.

### Regra 6

Não introduzir dependências sem necessidade.

### Regra 7

Preferir Web APIs nativas.

### Regra 8

Core não pode depender da UI.

### Regra 9

Parser não deve conter lógica de apresentação.

### Regra 10

Storage não deve contaminar Core.

### Regra 11

Idioma não deve contaminar Core.

### Regra 12

Toda funcionalidade nova deve possuir testes.

### Regra 13

Todo bug corrigido deve ganhar um teste de regressão.

### Regra 14

Não fazer refatorações gigantescas durante uma tarefa pequena.

### Regra 15

Manter o projeto executável ao final de cada tarefa.

---

# 23. Regra arquitetural mais importante

O fluxo de dependências deve ser sempre aproximadamente:

```text
APP
 │
 ├───────────────┐
 ▼               ▼
REPORT         STORAGE
 │
 ▼
CORE
 ▲
 │
PARSER
```

Mas o Core nunca deverá depender de:

```text
APP
REPORT
STORAGE
DOM
IndexedDB
OPFS
Preact
BeerCSS
```

O objetivo é poder executar:

```ts
import { ... } from "./src/core/...";
```

diretamente no Deno e nos testes.

---

# 24. Visão futura

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

# 25. Filosofia do SyntaxMesh

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