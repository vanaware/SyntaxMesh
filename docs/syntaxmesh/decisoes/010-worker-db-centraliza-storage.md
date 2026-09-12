# worker-db centraliza storage

## Contexto

O SyntaxMesh precisa de armazenamento persistente para projetos, configurações e arquivos associados. As APIs disponíveis no navegador são IndexedDB e OPFS (Origin Private File System), ambas com interfaces assíncronas e específicas do navegador. O Core do SyntaxMesh deve permanecer independente dessas APIs para ser executável em Deno, Web Workers e testes.

## Decisão

Centralizar toda interação com IndexedDB e OPFS através do pacote `@syntaxmesh/worker-db`, que atua como uma camada de abstração sobre essas APIs de armazenamento.

- O `@syntaxmesh/worker-db` expõe uma interface simples `KeyValueStore` com métodos `get`, `set`, `del`, `keys`, etc.
- O `@syntaxmesh/storage` consome exclusivamente a interface do `worker-db`, nunca acessando `idb-keyval` ou OPFS diretamente.
- O Core nunca importa nada relacionado a storage ou worker-db.
- Trocar entre IndexedDB e OPFS (ou adicionar novos backends) não afeta as camadas superiores (storage, Core, etc.).
- Testes do Storage podem usar um fake do `worker-db` para isolamento.

## Consequências

### Positivas
- Fronteira clara entre lógica de aplicação e detalhes de armazenamento
- Independência do Core em relação a APIs de navegador
- Facilidade de troca ou atualização de mecanismos de storage
- Testabilidade aprimorada através de injeção de dependência/fakes
- Conformidade com ADR 001 (Core independente de DOM) e ADR 003 (Storage não contamina Core)

### Negativas / Riscos
- Indireção adicional na camada de storage
- Necessidade de manter e atualizar o worker-db conforme APIs evoluem
- Sobrecarga mínima de performance devido à camada adicional

### Neutras / Observações
- Esta decisão valida e expande o conceito introduzido no ADR 003
- O worker-db se torna um ponto único de verdade para todas as operações de storage
- Facilita a implementação de recursos como backup, sincronização e versionamento
- A interface KeyValueStore pode ser expandida com operações avançadas (transactions, índices) conforme necessário

---

**Status:** Aceito
**Data:** 2026-09-11
**Autor(es):** Qwen Code