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