# Elaborar este documento de complemento de fase 

Refatorar este documento seguindo o modelo de documento de fase deste projeto e criar o documento docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md detalhado seguindo o modelo docs/syntaxmesh/fases/modelo-tarefas.md

## Elementos Materiais 

No syntaxmesh tivemos a criação de novos elementos materiais e acrescimos na forma de contabilizar custos conforme descrito em:
* docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
* docs/syntaxmesh/fases/fase-8.2-modelo-contabil-estendido.md


Analise o documento docs/tj3-engine/tj3-reports.md e elabore atividades de desenvolvimento para integrar os novos elementos do syntaxmesh nos relatórios que serão disponibilizados ao usuário. Exemplo:
* materialreport

Avaliar se os relatórios abaixo precisam de integração ao desenvolvimento adicional para incorporar materiais:
* Statussheetreport poderia mostrar materiais tambem
* "Calendar" Report
* htmlstatusreport
* xmlreport
* textreport (disponibilizando materiais, custos e accounts)
* tracereport (e ainda a opção hidematerial)
* export (e ainda a opção hidematerial)
* Nikureport
* tracereport
* iCalendar
* tagfile
* chartplotter

## Elemento picture

O elemento picture e os relatórios do tipo RDO descritos em :
* docs/syntaxmesh/fases/fase-11-logical-gaps.md
* docs/syntaxmesh/fases/fase-11-logical-complemento.md

Incorporar estas atividade e desenvolver estes engines de relatório especificados nestas fase

## Complemento ao relatório Mspxml

no arquivo docs/tj3-engine/mspdi.md reuni algumas informações sobre o formato do microsoft project em xml que podem ser uteis para aperfeiçoarmos nosso syntaxmesh

podemos exportar recursos materiais (que temos no syntaxmesh) e recursos do tipo custo (melhorado no syntaxmesh) suas alocações em tarefas, e inclusive as informações de controle como andamento das tarefas, atribuições ao longo do tempo, notes e varios elementos que temos no taskjuggler original e também nos complementos do syntaxmesh e que podem ser exportados no formato xml do mspdi

mapear estes elementos e implementar uma exportação mais completa para o relatório MspXml do syntaxmesh

## Markdown

Temos no SyntaxMesh a opção de geração de texto com markdown:
* docs/syntaxmesh/fases/fase-13-markdown.md

Os relatórios poderiam ter header, footer, navbar, elementos que hoje os relatórios do taskjuggler usam richtext, ter a opção de usar markdown para ter o mesmo resultado.

Adaptar rtf-handlers e rtf-navigater, queries, logical disponiveis nos relatórios dentro de richtext para tambem serem disponibilizados dentro de markdown para ter o mesmo resultado.

Analisar rtfreport + RTFreportlink completion + URLparameter para uso adicional com markdown