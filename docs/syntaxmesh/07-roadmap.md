# Plano geral

O desenvolvimento será dividido em 21 fases:

```text
FASE 1  Fundação e Workspace Deno
   ↓
FASE 2  Tempo e Geometria (Core)
   ↓
FASE 3  Parser + Linguagem
   ↓
FASE 4  Reports
   ↓
FASE 5  Storage (utils + worker-db)
   ↓
FASE 6  PWA (Service Worker)
   ↓
FASE 7  Interface (UI)
   ↓
FASE 8  Compatibilidade e Qualidade
   ↓
FASE 9  Core: Modelos (Project, Task, Resource, etc.)
   ↓
FASE 10 Core: Calendário e Tempo
   ↓
FASE 11 Core: Scheduling e Algoritmos
   ↓
FASE 12 Core: Recursos e Contabilidade
   ↓
FASE 13 Core: Cenários e Validação
   ↓
FASE 14 Parser: Lexer e Tokens
   ↓
FASE 15 Parser: Gramática e AST
   ↓
FASE 16 Parser: Análise Semântica
   ↓
FASE 17 Parser: Multi-idioma
   ↓
FASE 18 Report: Modelos e Filtros
   ↓
FASE 19 Report: Gantt e Exportação
   ↓
FASE 20 Storage: Persistência e Transferência
   ↓
FASE 21 Documentação e Manual do Usuário
```

## Roadmap resumido

```text
                    SYNTAXMESH
                        │
        ┌───────────────┴────────────────┐
        │                                │
     ENGINE                           APP
        │                                │
        ▼                                ▼
     FASE 1                           FASE 7
     Fundação                         Interface
        │                                │
        ▼                                ▼
     FASE 2                           FASE 8
     Core                              Compatibilidade
        │                                │
        ▼                                ▼
     FASE 3                           FASE 9+
     Parser                            (Core detalhado)
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
                     FASE 6
              PWA / Service Worker
```

---

## Ordem de prioridade

A prioridade será:

### Prioridade 1

```text
Foundation
Core
Parser
```

Sem interface.

---

### Prioridade 2

```text
Scheduler
Reports
```

---

### Prioridade 3

```text
Storage
PWA
```

---

### Prioridade 4

```text
UI
```

---

### Prioridade 5

```text
TaskJuggler compatibility
Performance
Security
```
