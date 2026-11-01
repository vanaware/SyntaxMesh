# Guia Completo de MSPDI (Microsoft Project XML Data Interchange)

Este guia consolida as principais características do formato MSPDI, incluindo estrutura fundamental, tarefas, recursos, atribuições, calendários, linhas de base e elementos de acompanhamento. O MSPDI é definido pelo esquema `mspdi_pj12.xsd`, e sua estrutura de nível superior é composta por `<Project>`, contendo `<Calendars>`, `<Tasks>`, `<Resources>` e `<Assignments>`.

---

## 1. Estrutura Fundamental e Tipos de Dados

### 1.1 Formato de Duração
O MSPDI utiliza o formato de duração ISO 8601: `PnYnMnDTnHnMnS`. Por exemplo, `PT8H0M0S` representa 8 horas, e `P1Y2M3DT10H30M` representa 1 ano, 2 meses, 3 dias, 10 horas e 30 minutos.

### 1.2 Formato de Data e Hora
`YYYY-MM-DDTHH:MM:SS`, por exemplo: `2026-11-02T08:00:00`.

### 1.3 Identificador Único
Cada `<Task>`, `<Resource>` e `<Assignment>` deve possuir um `<UID>` único (inteiro), utilizado para referências cruzadas. O `<ID>` é apenas um número de sequência de exibição; as referências devem sempre utilizar o UID.

---

## 2. Tarefas (`<Tasks>`)

### 2.1 Campos Centrais

| Elemento | Descrição | Tipo de Dados |
|:---|:---|:---|
| `<UID>` | Identificador único | integer |
| `<ID>` | Número de sequência de exibição | integer |
| `<Name>` | Nome da tarefa | string |
| `<Type>` | Tipo de tarefa (0=Unidades Fixas, 1=Duração Fixa, 2=Trabalho Fixo) | integer |
| `<Start>` / `<Finish>` | Data de início / término agendada | dateTime |
| `<Duration>` | Duração | duration |
| `<DurationFormat>` | Formato da duração (ver seção 2.2) | integer |
| `<Work>` | Trabalho total | duration |
| `<EffortDriven>` | Controlada pelo esforço | boolean |
| `<Milestone>` | Marco | boolean |
| `<Summary>` | Tarefa de resumo | boolean |
| `<Critical>` | Caminho crítico | boolean |
| `<Priority>` | Prioridade (0-1000) | integer |
| `<Notes>` | Notas | string |

### 2.2 Formato de Duração (`<DurationFormat>`) — Tabela Completa

O `<DurationFormat>` é um valor inteiro que, combinado com o `<Duration>`, determina a duração real do item. É um elemento crucial para distinguir corretamente entre dias úteis e dias corridos.

**Tabela completa de valores (fonte: documentação oficial da Microsoft):**

| Valor | Descrição (Unidade) | Sigla Comum |
|:---|:---|:---|
| **3** | Minutos | `m` |
| **4** | Minutos corridos (elapsed) | `em` |
| **5** | Horas | `h` |
| **6** | Horas corridas (elapsed) | `eh` |
| **7** | Dias | `d` |
| **8** | **Dias corridos (elapsed)** | **`ed`** |
| **9** | Semanas | `w` |
| **10** | Semanas corridas (elapsed) | `ew` |
| **11** | Meses | `mo` |
| **12** | Meses corridos (elapsed) | `emo` |
| **19** | Porcentagem | `%` |
| **20** | Porcentagem corrida (elapsed) | `e%` |
| **21** | Nulo (Null) | - |
| **35** | Minutos estimados | `m?` |
| **36** | Minutos corridos estimados | `em?` |
| **37** | Horas estimadas | `h?` |
| **38** | Horas corridas estimadas | `eh?` |
| **39** | Dias estimados | `d?` |
| **40** | **Dias corridos estimados** | **`ed?`** |
| **41** | Semanas estimadas | `w?` |
| **42** | Semanas corridas estimadas | `ew?` |
| **43** | Meses estimados | `mo?` |
| **44** | Meses corridos estimados | `emo?` |
| **51** | Porcentagem estimada | `%?` |
| **52** | Porcentagem corrida estimada | `e%?` |
| **53** | (Reservado/Indefinido) | - |

**Observação importante**: O valor `9` corresponde a **Semanas (`w`)**, não a dias corridos. Para **dias corridos (`ed`)**, o valor correto é **`8`**. A documentação oficial confirma: "7d é sete dias úteis (segunda a sexta e a segunda e terça seguintes); 7ed é sete dias corridos (segunda a domingo)".

### 2.3 Dependências e Restrições

**Método de vinculação**: Através do elemento `<PredecessorLink>` dentro de `<Task>`, incluindo `<PredecessorUID>`, `<Type>` (tipo de vínculo: FF, FS, SF, SS), `<LinkLag>` (quantidade de atraso/antecedência) e `<LagFormat>` (formato do atraso).

**Tipo de restrição**: `<ConstraintType>` (inteiro) e `<ConstraintDate>` (dateTime). Tipos comuns incluem: o mais cedo possível (ASAP), o mais tarde possível (ALAP), não iniciar antes de (SNET), etc.

**Prazo limite**: `<Deadline>` (dateTime).

### 2.4 Estrutura Hierárquica
`<OutlineLevel>` (nível de estrutura de tópicos) e `<OutlineNumber>` (número da estrutura de tópicos, como "1.2.3") definem a hierarquia de tarefas de resumo e subtarefas.

---

## 3. Recursos (`<Resources>`)

### 3.1 Distinção de Tipos

| Elemento | Valor | Significado |
|:---|:---|:---|
| `<Type>` | `0` | Recurso material (consumíveis) |
| `<Type>` | `1` | Recurso de trabalho (pessoas/equipamentos) |
| `<Type>` | `2` | Recurso de custo (despesas) |

> **Correção (2026-11-01, Fase 14-C / 14C.4):** esta tabela trazia `2` =
> material e `0` = custo, o inverso do esquema. A tabela oficial do elemento
> `Type` (Microsoft) define **0 = material, 1 = trabalho, 2 = custo**, e é a
> ordem usada por `reports/msp-xml-re.ts`.

### 3.2 Campos Específicos por Tipo

**Recurso de trabalho**:
- `<MaxUnits>`: Unidades máximas disponíveis (1.0 = 100%)
- `<StandardRate>`: Taxa horária padrão
- `<OvertimeRate>`: Taxa horária de horas extras
- `<CalendarUID>`: Referência ao calendário específico do recurso

**Recurso material**:
- `<MaterialLabel>`: Rótulo de unidade (como "toneladas", "sacos")
- `<StandardRate>`: Preço unitário (por unidade de material)

**Recurso de custo**:
- Geralmente não requer configuração de taxa; o valor é inserido diretamente em `<Cost>` na atribuição.

### 3.3 Campos Comuns
`<UID>`, `<ID>`, `<Name>`, `<Notes>`, `<IsBudget>` (se é recurso orçamentário).

---

## 4. Atribuições (`<Assignments>`)

### 4.1 Estrutura Central

| Elemento | Descrição |
|:---|:---|
| `<UID>` | Identificador único da atribuição |
| `<TaskUID>` | Referência ao `<UID>` da tarefa |
| `<ResourceUID>` | Referência ao `<UID>` do recurso |
| `<Units>` | Recurso de trabalho: proporção de alocação (1.0=100%); material: quantidade consumida |
| `<Work>` | Trabalho total |
| `<Cost>` | Custo total |
| `<Start>` / `<Finish>` | Início / término da atribuição |
| `<ActualWork>` | Trabalho real |
| `<ActualCost>` | Custo real |
| `<Notes>` | Notas |
| `<TimephasedData>` | Dados distribuídos no tempo (ver seção 7) |

### 4.2 Cálculo de Custos
- **Trabalho**: `Work × StandardRate`
- **Material**: `Units × StandardRate` (preço unitário)
- **Custo**: Preenchimento direto de `<Cost>`

---

## 5. Calendários (`<Calendars>`)

### 5.1 Estrutura do Calendário Base
```xml
<Calendar>
  <UID>1</UID>
  <Name>Padrão</Name>
  <IsBaseCalendar>1</IsBaseCalendar>
  <WeekDays>
    <WeekDay>
      <DayType>2</DayType>  <!-- 1=Domingo, 2=Segunda ... 7=Sábado -->
      <DayWorking>1</DayWorking>
      <WorkingTimes>
        <WorkingTime>
          <FromTime>08:00:00</FromTime>
          <ToTime>17:00:00</ToTime>
        </WorkingTime>
      </WorkingTimes>
    </WeekDay>
  </WeekDays>
</Calendar>
```

### 5.2 Exceções de Calendário
Utilize `<Exceptions>` para definir feriados ou dias úteis especiais, incluindo `<TimePeriod>` (período de datas) ou `<Occurrences>` (número de ocorrências).

### 5.3 Calendário Específico de Recursos
No `<Resource>`, utilize `<CalendarUID>` para referenciar um calendário definido em `<Calendars>`. Se não for especificado, utiliza o calendário base padrão do projeto.

---

## 6. Linhas de Base (`<Baseline>`)

As linhas de base são declaradas dentro de cada `<Task>`, podendo haver múltiplas (Number 0, 1, 2...).

```xml
<Task>
  <UID>1</UID>
  <Baseline>
    <Number>0</Number>
    <Start>2026-11-02T08:00:00</Start>
    <Finish>2026-11-02T17:00:00</Finish>
    <Duration>PT8H0M0S</Duration>
    <Work>PT8H0M0S</Work>
    <Cost>400</Cost>
    <BCWS>400</BCWS>
    <BCWP>200</BCWP>
  </Baseline>
</Task>
```

---

## 7. Elementos de Acompanhamento

### 7.1 Dados Distribuídos no Tempo (`<TimephasedData>`)
Este é o mecanismo central para registrar custos/trabalho por período. Pode aparecer em `<Task>`, `<Resource>`, `<Assignment>` e `<Baseline>`.

```xml
<TimephasedData>
  <Type>1</Type>
  <UID>1</UID>
  <Start>2026-11-02T08:00:00</Start>
  <Finish>2026-11-02T17:00:00</Finish>
  <Unit>2</Unit>
  <Value>8</Value>
</TimephasedData>
```

### 7.2 Progresso e Valores Reais
Campos disponíveis em `<Task>` e `<Assignment>`:
- `<PercentComplete>` / `<PercentWorkComplete>`: Percentual de conclusão
- `<ActualStart>` / `<ActualFinish>`: Datas reais
- `<ActualWork>` / `<ActualCost>`: Trabalho/custo real
- `<RemainingWork>` / `<RemainingCost>`: Trabalho/custo restante

### 7.3 Análise de Valor Agregado
- `<BCWS>`: Custo orçado do trabalho agendado
- `<BCWP>`: Custo orçado do trabalho realizado
- `<ACWP>`: Custo real do trabalho realizado
- `<CV>` / `<SV>`: Variação de custo / variação de prazo

### 7.4 Anotações e Alertas
- **Notas**: Utilize `<Notes>` em `<Task>`, `<Resource>` ou `<Assignment>` para registrar informações explicativas.
- **Alertas**: Através de `<ExtendedAttribute>` combinado com campos personalizados e indicadores gráficos, não existindo um campo XML dedicado para "alerta".

---

## 8. ⚠️ Alerta Crítico sobre o Uso de Dias Corridos (`ed`)

O uso da unidade `ed` (elapsed days) é poderoso para tarefas que verdadeiramente ocorrem 24x7, mas exige cuidado redobrado no formato MSPDI.

**1. A Armadilha do "Dia" de 24 Horas vs. 8 Horas**
Ao usar `ed`, o Project ignora completamente o calendário de trabalho e considera que a tarefa avança **24 horas por dia**, inclusive fins de semana e feriados. Isso significa que `1 ed` equivale a **24 horas de trabalho**, e não às 8 horas padrão de um dia útil. A documentação oficial confirma: "Uma duração de 7ed são sete dias corridos, como de segunda a domingo".

**2. Impacto no Campo `<Work>` e nos Custos**
Quando você define uma duração em `ed`, o campo `<Work>` da tarefa ou atribuição pode ser drasticamente inflado se não for tratado corretamente. Uma tarefa de `1ed` tem 24 horas de "trabalho" no papel, o que, multiplicado pela taxa horária de um recurso, pode gerar custos irreais.

**3. O "Buraco" no Caminho Crítico (Gap)**
Se uma tarefa com `ed` termina em um horário não útil (ex: domingo às 12:00), a tarefa sucessora (que usa calendário padrão de dias úteis) não poderá começar até segunda-feira às 08:00. Isso cria um **intervalo (gap)** na sequência, fazendo com que a tarefa anterior pareça ter uma "folga" (slack) que não existe na realidade, podendo distorcer a análise do caminho crítico.

**4. Representação Correta no MSPDI**
- **Valor `8`**: `<DurationFormat>` deve ser **`8`** para "dias corridos (`ed`)".
- **Valor `9`**: Corresponde a **semanas (`w`)** — usar `9` para dias corridos causará erro grave de cronograma.
- **Duração**: O `<Duration>` será expresso em horas totais. Por exemplo, `3ed` seria gravado como `PT72H0M0S`.

**5. Efeito nos Resumos (Summary Tasks)**
Tarefas de resumo que agregam tarefas com `ed` e tarefas com `d` podem ter cálculos de duração confusos. O Project tentará converter tudo para uma unidade comum, e a exibição pode não refletir a realidade se os calendários forem muito diferentes.

### 💡 Recomendação
*   **Use `ed` com moderação**: Reserve para processos que realmente não param (cura de materiais, processos químicos, espera de aprovação externa).
*   **Verifique `<DurationFormat>`**: Certifique-se de que está configurado para **`8`** (ed) nas tarefas que usam dias corridos.
*   **Monitore o Caminho Crítico**: Após a importação, revise o caminho crítico no Project para garantir que os "gaps" de fim de semana não estejam mascarando dependências reais.

---

## 9. Modelo Rápido de Arquivo Completo

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Projeto Exemplo</Name>
  <DefaultOvertimeRate>75</DefaultOvertimeRate>

  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Padrão</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
    </Calendar>
  </Calendars>

  <Tasks>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Tarefa A</Name>
      <Type>1</Type>
      <Duration>PT8H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
      <Start>2026-11-02T08:00:00</Start>
      <Baseline>
        <Number>0</Number>
        <Start>2026-11-02T08:00:00</Start>
        <Duration>PT8H0M0S</Duration>
        <Cost>400</Cost>
      </Baseline>
    </Task>
  </Tasks>

  <Resources>
    <Resource>
      <UID>1</UID>
      <ID>1</ID>
      <Name>João</Name>
      <Type>1</Type>
      <MaxUnits>1</MaxUnits>
      <StandardRate>50</StandardRate>
      <OvertimeRate>75</OvertimeRate>
    </Resource>
    <Resource>
      <UID>2</UID>
      <ID>2</ID>
      <Name>Cimento</Name>
      <Type>2</Type>
      <MaterialLabel>toneladas</MaterialLabel>
      <StandardRate>400</StandardRate>
    </Resource>
  </Resources>

  <Assignments>
    <Assignment>
      <UID>1</UID>
      <TaskUID>1</TaskUID>
      <ResourceUID>1</ResourceUID>
      <Units>1</Units>
      <Work>PT8H0M0S</Work>
      <Cost>400</Cost>
    </Assignment>
    <Assignment>
      <UID>2</UID>
      <TaskUID>1</TaskUID>
      <ResourceUID>2</ResourceUID>
      <Units>2</Units>
      <Cost>800</Cost>
    </Assignment>
  </Assignments>
</Project>
```

---

## 10. Observações Práticas

1. **Prioridade de referências**: Todos os `TaskUID` e `ResourceUID` devem corresponder ao `<UID>` (não ao `<ID>`).
2. **Recálculo na abertura**: O Project, ao abrir um arquivo MSPDI, recalcula datas com base nas dependências e no calendário.
3. **Compatibilidade de versões**: O esquema `mspdi_pj12.xsd` corresponde ao Project 2007, sendo compatível com versões posteriores.
4. **Segurança**: Ao importar arquivos MSPDI de fontes externas, deve-se desabilitar a expansão de entidades XML e o carregamento de entidades externas para prevenir ataques XXE.
5. **Consistência de `<DurationFormat>`**: Sempre valide se o `<DurationFormat>` está coerente com a unidade desejada. Para tarefas normais de dias úteis, o padrão costuma ser **`7`** (dias). Para tarefas de espera (como cura de concreto), utilize **`8`** (dias corridos).