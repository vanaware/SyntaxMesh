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