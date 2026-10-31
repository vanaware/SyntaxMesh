# Guia dos Relatórios do TaskJuggler

O TaskJuggler possui diversos tipos de relatórios, cada um voltado para uma finalidade específica. Abaixo, uma explicação organizada de cada um, com foco no que cada relatório **faz** e **quais dados pode conter**.

---

## 1. Resourcereport (Relatório de Recursos)

**O que é:** Relatório centrado em **recursos** (pessoas, equipamentos). Mostra dados como alocação, eficiência, custos e tarefas associadas a cada recurso.

**Dados disponíveis (colunas):** `name`, `id`, `utilization`, `efficiency`, `freeload`, `rate`, `maxeffort`, `projectids`, `responsibilities`, `schedule`, entre outros .

**Exemplo:**
```taskjuggler
resourcereport "Recursos" {
  formats html
  columns name, efficiency, utilization, rate
}
```

---

## 2. Taskreport (Relatório de Tarefas)

**O que é:** Relatório centrado em **tarefas**. É o tipo mais comum, usado para listar tarefas com datas, esforço, dependências e progresso.

**Dados disponíveis (colunas):** `name`, `start`, `end`, `effort`, `duration`, `completed`, `completedeffort`, `remainingeffort`, `depends`, `resources`, `responsible`, `priority`, `criticalness`, `cost`, `revenue`, `chart`, `daily`, `weekly`, `monthly`, entre muitos outros .

**Exemplo:**
```taskjuggler
taskreport "Tarefas" {
  formats html, csv
  columns name, start, end, effort, completed
}
```

---

## 3. Accountreport (Relatório de Contas)

**O que é:** Relatório centrado em **contas/custos**. Usado para visualizar valores monetários como custos, receitas e lucros acumulados por tarefa ou período.

**Dados disponíveis (colunas):** `name`, `cost`, `revenue`, `profit`, além de colunas de tarefas quando aplicável .

**Exemplo:**
```taskjuggler
accountreport "Custos" {
  formats html
  columns name, cost, revenue, profit
}
```

---

## 4. Statussheetreport (Relatório de Folha de Status)

**O que é:** Gera um **modelo** (arquivo `.tji`) para que gerentes preencham o status das tarefas pelas quais são responsáveis. Não exibe dados do projeto; é uma ferramenta de **entrada de dados**.

**Mecanismo:** Coleta tarefas de nível superior associadas a um recurso e gera um arquivo com a instrução `statussheet` pronta para ser preenchida .

**Exemplo:**
```taskjuggler
statussheetreport "StatusTemplate.tji" {
  # Opcional: hidetask, hideresource, start, end
}
```

---

## 5. "Calendar" Report (Relatório de Calendário)

**O que é:** Relatórios que exibem tarefas em formato de **calendário** (semanal ou mensal). São variantes HTML: `htmlweeklycalendar` e `htmlmonthlycalendar`.

**Dados disponíveis:** Colunas de visualização de calendário como `daily`, `weekly`, `monthly`, `quarterly`. A apresentação é feita em grade de dias/semanas .

**Exemplo:**
```taskjuggler
htmlweeklycalendar "CalendarioSemanal.html" {
  columns name, weekly
}
```

---

## 6. Status Report (Relatório de Status)

**O que é:** Gera uma página HTML que lista **tarefas atrasadas, em andamento, concluídas na última semana e que iniciarão na próxima semana**. Útil para reuniões de acompanhamento .

**Sintaxe:** `htmlstatusreport "arquivo.html" { }`

**Exemplo:**
```taskjuggler
htmlstatusreport "Status-Report.html" {
}
```
*(Não requer colunas; o conteúdo é gerado automaticamente com base no estado atual do projeto.)*

---

## 7. XML Report (Relatório XML)

**O que é:** Exporta os dados do projeto em **formato XML**. Útil para integração com outras ferramentas (ex: `tjx2gantt`).

**Pontos importantes:** É obrigatório especificar `version 1` ou `version 2`. A versão 2 é comprimida com gzip. Recomenda-se extensão `.tjx` .

**Exemplo:**
```taskjuggler
xmlreport "Projeto.tjx" {
  version 1
}
```

---

## 8. Text Report (Relatório de Texto)

**O que é:** Relatório simples em formato de **texto puro**. Geralmente usado para depuração ou visualização rápida no terminal. Compartilha as mesmas colunas de `taskreport` e `resourcereport` .

**Exemplo:**
```taskjuggler
textreport "Tarefas.txt" {
  columns name, start, end
}
```

---

## 9. Trace Report (Relatório de Rastreamento)

**O que é:** Registra valores de atributos selecionados em um **arquivo CSV ao longo do tempo**. Cada execução do `tj3` com `--add-trace` adiciona uma nova linha (snapshot) ao CSV. Permite acompanhar a evolução de métricas (ex: esforço restante) ao longo do projeto .

**Funcionamento:** A primeira coluna do CSV é a data do snapshot. As demais colunas são definidas pelo usuário via `columns`. É necessário usar `hidetask` ou `hideresource` para selecionar quais propriedades incluir .

**Exemplo:**
```taskjuggler
tracereport "TraceReport" {
  columns end { title "<-name->" }
  hidetask 0
}
```

---

## 10. Export (Exportação de Agendamento)

**O que é:** Exporta os resultados do agendamento (datas fixas de início/término) como um arquivo `.tjp` ou `.tji`. **Não é um relatório visual**, mas sim uma forma de reutilizar dados em outro projeto via `include`.

**Diferença de extensão:**
- `.tjp`: gera projeto completo com cabeçalho e recursos.
- `.tji`: apenas tarefas e alocações de recursos .

**Exemplo:**
```taskjuggler
export "FullProject.tjp" {
  taskattributes all
  hideresource 0
}
```

---

## 11. Status Sheet Report (Relatório de Folha de Status)

**O que é:** O mesmo que o item 4 (`statussheetreport`). Gera o modelo `.tji` para preenchimento de status por gerentes. A distinção na sua lista é apenas de nomenclatura; ambos referem-se à mesma funcionalidade .

---

**Resumo:** Use `taskreport`/`resourcereport` para visualização de dados, `htmlstatusreport` para acompanhamento semanal, `statussheetreport` para coleta de status, `xmlreport`/`export` para integração e reuso, e `tracereport` para acompanhamento histórico de métricas.