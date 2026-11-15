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

## Lacunas de compatibilidade conhecidas (F21¹)

Lista de features ausentes/divergentes levantada pela triagem e2e da 1ª onda
da Fase 21 (golden CLI × `tj3`, 395 fixtures). Cada item tem verbete e âncora
em [`packages/cli/tests/golden/known_divergences.md`](../../packages/cli/tests/golden/known_divergences.md)
e no registro máquina `known-divergences.json` — nada é ignorado em silêncio.

* **Reconciliação do scheduler** (D7, D8, D11–D33, D39, D40): validação
  específica de dependências (self/child/parent/unknown), detecção de
  dependências de gap/sobreposição impossíveis, e capacidade de scheduling
  (prioridade, recursos persistentes, time sheets, alocação) onde o port sai
  com erro e o `tj3` agenda. Saída: reconciliar `Project.schedule()` com
  `Project.rb`.
* **Motor de queries** (D34–D38): avaliação dos checks `fail`/`warn` definidos
  pelo usuário (hoje o port não os avalia; o `tj3` sim).
* **Serialização de relatórios** (D2, D3, D10, D44): marshaling de célula CSV
  (float integral, célula vazia/`<Error>`), linha `Total` do balance, conteúdo
  dos `csv-reports` e o relatório `export` (re-emissão `.tjp`). Saída: golden
  completo de relatórios.
* **Subset de gramática** (D41, D42): o port aceita um superconjunto de
  tokens/top-level do TJP; decidir o subset suportado na matriz de
  compatibilidade.
* **Diagnósticos** (D43): renderização de data em mensagens de erro (instante
  de fim de dia × meia-noite).

As normalizações de mensagem (data, float, localização, progresso — D45) não
são lacunas: a diferença é de representação e segue comparada após normalizar.

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