# Sheets sem SMTP: sender produz texto de email, receiver consome texto de mensagem

**Status:** Aceito
**Data:** 2026-11-05
**Fase:** 18 (Time/Status Sheets)

## Contexto

O TaskJuggler original captura progresso real por **email**:

- `tj3ts_sender` gera o template `.tji` de cada recurso e o envia por **SMTP**
  (gem `Mail`), com `emailDeliveryMethod` = `smtp` ou `sendmail`.
- `tj3ts_receiver` lê a **caixa de correio** (RFC 822 do `$stdin`), extrai o
  anexo `.tji` ou o corpo da mensagem, valida via `tj3client --check-ts` e
  responde com um email de confirmação (`sendRichTextEmail`).
- `tj3ts_summary` consolida as submissões e envia o digest + lembretes.
- `SheetHandlerBase#addToScm` roda `git add` via subprocesso; `#log` escreve em
  arquivo; `#htmlMailBody` lê `data/css/tjreport.css` do disco.

Nenhuma dessas capacidades existe no browser (ADR 001/003/005):

| Ruby | Browser |
|---|---|
| SMTP / `Mail` | **não existe** (sem socket de saída para portas de email) |
| Leitura de mailbox | **não existe** (sem IMAP/mbox) |
| `scmCommand` via subprocesso | **não existe** |
| `tj3client` via subprocesso | chamada in-process ao `Project` |
| `dataDirs`/`Dir.chdir`/`File.*` | `FileStore` injetado (ADR 037) |
| `resources.yml` (YAML) | `resources.json` (JSON nativo) |

Um backend de envio de email violaria o ADR 005 (browser-only) e o ADR 027
(reports/sheets devolvem strings, sem escrita a disco).

## Decisão

O core do SyntaxMesh **não se conecta a nenhum aplicativo de email**. As três
responsabilidades são separadas:

1. **Sender** (`TimeSheetSender`, `StatusSheetSender`) monta e **devolve o texto
   do email** — cabeçalhos `To`/`Cc`/`Subject`, corpo `text/plain` e `text/html`
   e o anexo `.tji`/`.tjs` em **base64** — na forma de um `EmailMessage`. Ele não
   abre socket, não chama `sendmail`, não escreve em `outbox/` por padrão. A UI
   (Fase 20) oferece download/copiar/Web Share API; a CLI (Fase 24) imprime em
   stdout ou grava com `--output`.
2. **Receiver** (`TimeSheetReceiver`, `StatusSheetReceiver`, `TimeSheetSummary`)
   consome **texto de mensagem** — a string RFC 822 que o usuário obteve do seu
   cliente de email e passou como arquivo/stdin — nunca uma mailbox viva.
3. **Persistência e SCM** são delegados ao `FileStore` injetado (ADR 037). Sem
   `scmCommand` o `addToScm` é no-op; com `scmCommand` definido, emite
   `warning('scm_not_supported_in_browser')` e **não** executa nada.

### Consequências diretas da decisão

- `sendEmail`/`sendRichTextEmail` são assíncronos e, quando `dryRun`, devolvem o
  texto em vez de enviar; quando há `FileStore`, podem opcionalmente persistir a
  mensagem em `outbox/`.
- `SheetReceiver` aceita a mensagem como parâmetro (`processEmail(rawMail)`);
  `$stdin` é responsabilidade do app/CLI.
- `htmlMailBody` usa CSS **inline** (não há `tjreport.css` garantido no
  bundle); a folha continua sendo um detalhe de apresentação.
- `resources.yml` → `resources.json`; a leitura usa `JSON.parse` nativo, sem
  dependência YAML.
- `checkTimeSheet`/`checkStatusSheet` chamam `Project` in-process, sem
  `Tj3Client`/daemon.

### Política de email dos apps de sheet (18.18)

| App | Ruby | SyntaxMesh |
|---|---|---|
| `ts send` / `ss send` | `Mail` + SMTP | devolve `EmailMessage[]` (texto + anexo base64) |
| `ts receive` / `ss receive` | lê mbox/IMAP | recebe texto de mensagem (arquivo/stdin) |
| `ts summary` | envia emails | devolve `EmailMessage[]` (um por recurso + digest) |

## Alternativas consideradas

- **SMTP no browser** — inviável: browsers não abrem conexões TCP para portas
  de email. Rejeitada.
- **Servidor backend de email** — viola o ADR 005 (browser-only) e o objetivo
  offline-first da PWA (Fase 20). Rejeitada.
- **Leitura de mailbox (IMAP/mbox) no core** — inviável no browser e acoplaria
  o core a um protocolo de rede. Rejeitada.

## Consequências

### Positivas

- Core 100% testável, determinístico e offline: os testes comparam **strings**
  de email, sem rede.
- A mesma montagem serve UI (download), CLI (stdout) e Web Share API futura,
  sem duplicação.
- Nenhum segredo (SMTP host/user/senha) precisa existir no browser.

### Negativas / Riscos

- O fluxo é **manual**: o usuário baixa o `.tji`, anexa no email e cola a
  resposta de volta. Mitigação: a CLI (Fase 24) e a UI (Fase 20) automatizam o
  transporte do lado do usuário; a Web Share API pode cobrir mobile.
- `emailDeliveryMethod`/`smtpServer` permanecem como campos para compatibilidade
  de configuração (`tj3Config`), mas são inertes — `setWorkingDir` avisa em vez
  de falhar.

### Neutras / Observações

- O formato do texto de email segue o `Mail#to_s` do Ruby no essencial
  (`From`/`To`/`Subject`/`Date`/`MIME-Version`/`Content-Type` + partes base64),
  o suficiente para o receiver do próprio SyntaxMesh reprocessar o texto.
- Referências: `docs/taskjuggler/lib/taskjuggler/{SheetHandlerBase,SheetSender,SheetReceiver}.rb`,
  `docs/syntaxmesh/fases/fase-18-time-status-sheets.md` §4.1–4.6.
