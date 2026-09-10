# Arquivo `CURRENT.md`

Leia os arquivos:
- docs/syntaxmesh/00-index.md
- docs/syntaxmesh/01-visao.md
- docs/syntaxmesh/02-principios.md
- docs/syntaxmesh/03-arquitetura.md
- docs/syntaxmesh/06-testes-e-processo.md
- docs/syntaxmesh/07-roadmap.md
- docs/syntaxmesh/09-regras-para-ia.md

Tenha conhecimento da lista de ADR em : docs/syntaxmesh/decisoes/README.md

Implementar a tarefa (docs/syntaxmesh/fases/):
- fase-3-parser-multilingue.md

Depois revisite a fase 2 e veja a possibilidade de investigar o código fonte do taskjuggler na pasta - docs/taskjuggler e o codigo fonte do parser e types na pasta - docs/webjuggler e comparar minuciosamente as funcionalidades e características de cada um. verifique se não faltou nenhum key word ou objeto para ser mapeado. se precisar complemente nosso todolist e salve o relatório como: docs/syntaxmesh/fases/fase-3.1-análise-comparativa.md

Preciso avaliar se o motor de agendamento de tarefas e montagem das interdependencias e hierarquias está bem desenvolvido e com o comportamento esperado quando se usa o taskjuggler.
se quiser montar uma seção de testes comparativos entre o resultado de planejamento entre o tj3 e nosso core, voce tem o tj3 instalado e disponivel para execução em bash além do código fonte dele. Estes teste comparativos podem ser salvos na pasta - tests/taskjuggler

IMPORTANTE: para testes veja a decisão de qual biblioteca e estilo de teste fazer no arquivo: docs/syntaxmesh/decisoes/008-biblioteca-de-testes-std-testing-bdd-padrao.md