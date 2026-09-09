# MVP

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
language "en"

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

O sistema deverá:

1. ler o arquivo;
2. reconhecer português;
3. construir AST;
4. criar tarefas;
5. resolver dependência;
6. calcular datas;
7. gerar relatório;
8. gerar Gantt.

Depois disso, adicionar poutuguês brasileiro e opcionalmente espanhol.

---