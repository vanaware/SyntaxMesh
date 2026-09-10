# Lista Completa de Palavras-Chave do TaskJuggler (tj3)

Baseado no arquivo de sintaxe do Vim fornecido (docs/taskjuggler/data/tjpvim.txt), aqui está a lista completa organizada por categorias:

## 🏗️ Blocos Principais (Estruturais)

```
project        task           resource       account
scenario       shift          supplement     macro
```

## 📋 Relatórios (Reports)

```
taskreport         resourcereport     accountreport
textreport         tracereport        timesheetreport
statussheetreport  nikureport         icalreport
export             tagfile
```

## 📝 Entrada de Dados

```
journalentry   timesheet     statussheet   booking
```

## 🎯 Atributos de Projeto

```
currency              currencyformat       dailyworkinghours
yearlyworkingdays     weekstartsmonday     weekstartssunday
timezone              timingresolution     shorttimeformat
timeformat            outputdir            trackingscenario
alertlevels           numberformat         markdate
now                   journalattributes    journalmode
workinghours
```

## 📌 Atributos de Tarefa (Task)

```
start              end                duration         length
effort             effortdone         effortleft       complete
priority           milestone          scheduled        scheduling
schedulingmode     depends            precedes         responsible
allocate           booking            charge           chargeset
limits             period             flags            note
adopt              warn               fail             projectid
shifts             minstart           maxstart         minend
maxend             gapduration        gaplength        onstart
onend
```

## 👤 Atributos de Recurso (Resource)

```
email              rate               efficiency       managers
shifts             vacation           leaves           leaveallowances
workinghours       booking            limits           chargeset
flags              warn               fail
```

## 💰 Atributos de Conta (Account)

```
aggregate          credits            flags            rate
```

## ⏱️ Atributos de Shift

```
workinghours       vacation           leaves           replace
timezone
```

## 📊 Atributos de Timesheet

```
newtask            work               remaining        status
priority           shift              task
```

## 🚧 Limites (Limits)

```
limits             dailymax           dailymin
weeklymax          weeklymin          monthlymax
monthlymin         maximum            minimum
start              end                period           resources
```

## 🔗 Dependências e Precedências

```
depends            precedes           gapduration      gaplength
onstart            onend
```

## 📐 Atributos de Colunas (Columns)

```
columns            title              width            halign
celltext           cellcolor          fontcolor        listitem
listtype           period             scale            start
end                timeformat1        timeformat2      tooltip
```

## 🏷️ Prefixos e Identificadores

```
taskprefix         resourceprefix     accountprefix    reportprefix
projectid          projectids
```

## 🎨 Atributos de Relatório (Report)

```
accountroot        taskroot           resourceroot     scenarios
period             start              end              headline
header             footer             prolog           epilog
caption            title              center           left
right              height             width            opennodes
sorttasks          sortresources      sortaccounts     sortjournalentries
rolluptask         rollupresource     rollupaccount    selfcontained
timezone           loadunit           formats          definitions
taskattributes     resourceattributes
```

## 🔍 Filtros e Navegação

```
hidetask           hideresource       hideaccount      hidejournalentry
novevents          navigator          hidereport       purge
```

## 📈 IDs de Colunas (Column IDs)

```
activetasks        alert              alertmessages    alertsummaries
alerttrend         annualleave        annualleavebalance  annualleavelist
balance            bsi                chart            children
closedtasks        complete           completed        competitorcount
competitors        cost               criticalness     daily
directreports      duration           duties           efficiency
effort             effortdone         effortleft       email
end                flags              followers        freetime
freework           fte                gauge            headcount
hierarchindex      hourly             id               index
inputs             journal            journal_sub      journalmessages
journalsummaries   line               managers         maxend
maxstart           minend             minstart         monthly
name               no                 note             opentasks
pathcriticalness   precursors         priority         quarterly
rate               reports            resources        responsible
revenue            scenario           scheduling       seqno
sickleave          specialleave       start            status
targets            turnover           unpaidleave      wbs
weekly             yearly
```

## 🧩 Palavras-Chave de Extensão (Extend)

```
extend             date               number           reference
richtext           text               inherit          scenariospecific
```

## 🎭 Status e Flags

```
active             isactive           isvalid          isleaf
ismilestone        isongoing          isresource       istask
ischildof          isdependencyof     isdutyof         isfeatureof
isresponsibilityof hasalert           treelevel
```

## 🔤 Alinhamento

```
center             left               right
```

## 📦 Outras Palavras-Chave

```
include            copyright          auxdir           balance
loadunit           aggregate          credits          mandatory
persistent         alternative        select           timeoff
fail               sloppy             overtime         @
```

## 🎨 Tipos de Dados e Literais

- **Strings**: `"texto"` ou `'texto'` ou `-8<- ... ->8-` (heredoc)
- **Datas**: `YYYY-MM-DD` ou `YYYY-MM-DD-HH:MM:SS±ZZZZ`
- **Horas**: `HH:MM` ou `HH:MM:SS`
- **Números**: com sufixos `h` (horas), `d` (dias), `w` (semanas), `m` (meses), `y` (anos), `min` (minutos)
- **Argumentos de macro**: `${...}`

## 💡 Dicas de Sintaxe

- **Comentários**: `#` ou `//` (linha única) e `/* ... */` (bloco)
- **Blocos**: delimitados por `{ ... }`
- **Indentação**: 2 espaços (recomendado)
- **Comando de execução**: `:make seu_projeto.tjp` (dentro do Vim)
- **Manual**: `tj3man` (Shift-K sobre uma keyword)
