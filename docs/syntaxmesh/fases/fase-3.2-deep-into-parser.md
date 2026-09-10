# 📚 5 Arquivos Essenciais para Mapear o Core Engine do TaskJuggler

Analisando a estrutura do código fonte, selecionei os 5 arquivos que formam o **pipeline completo de processamento das keywords** — do scanner até a documentação. Essa combinação permite entender **como cada palavra-chave é reconhecida, validada, interpretada e documentada**.

## 🎯 Os 5 Arquivos Recomendados

arquivos estão na pasta: docs/taskjuggler/

### 1. 📜 `lib/taskjuggler/TjpSyntaxRules.rb`
**O "cérebro" da sintaxe** — define **todas** as regras gramaticais do `.tjp`/`.tji`. É aqui que cada keyword é declarada com seu contexto (onde pode aparecer), seus argumentos e suas restrições.

> **Por que é essencial:** Contém o mapeamento direto `keyword → regra sintática`. É o equivalente ao "grammar file" de um compilador.

---

### 2. 🔍 `lib/taskjuggler/ProjectFileScanner.rb`
**O lexer/scanner** — responsável por **tokenizar** o arquivo fonte, identificando keywords, strings, datas, números, comentários e identificadores.

> **Por que é essencial:** Mostra como o texto bruto é transformado em tokens. Sem ele, não dá para entender como `project`, `task`, `resource` etc. são "enxergados" pelo parser.

---

### 3. 🧩 `lib/taskjuggler/ProjectFileParser.rb`
**O parser propriamente dito** — consome os tokens do scanner e constrói a árvore de objetos do projeto (tasks, resources, accounts, reports).

> **Por que é essencial:** Revela **como as keywords são interpretadas** e quais objetos Ruby são instanciados para cada uma. É onde a semântica emerge da sintaxe.

---

### 4. 📖 `lib/taskjuggler/SyntaxReference.rb`
**A referência estruturada da sintaxe** — gera a documentação oficial (usada pelo `tj3man`). Contém descrições formais de cada keyword, seus tipos de argumento e exemplos.

> **Por que é essencial:** É a "fonte da verdade" para documentação. Complementa o `TjpSyntaxRules.rb` com informações semânticas.

---

### 5. 📝 `lib/taskjuggler/KeywordDocumentation.rb`
**A documentação textual de cada keyword** — contém as descrições em linguagem natural que aparecem no manual.

> **Por que é essencial:** Fecha o ciclo: depois de entender a regra sintática e o parser, você entende **o que cada keyword significa** na prática.

---

## 🔄 Como Eles Se Relacionam (Pipeline)

```
Arquivo .tjp/.tji
      │
      ▼
┌─────────────────────────┐
│  ProjectFileScanner.rb  │  ← Tokeniza (reconhece keywords)
└───────────┬─────────────┘
            │ tokens
            ▼
┌─────────────────────────┐
│  ProjectFileParser.rb   │  ← Interpreta (aplica regras)
└───────────┬─────────────┘
            │ validação
            ▼
┌─────────────────────────┐
│  TjpSyntaxRules.rb      │  ← Define a gramática
└───────────┬─────────────┘
            │ consulta
            ▼
┌─────────────────────────┐
│  SyntaxReference.rb     │  ← Documentação estrutural
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ KeywordDocumentation.rb │  ← Documentação textual
└─────────────────────────┘
```
Ver mais arquivos de detalhamento do engine na pasta: docs/tj3-engine/