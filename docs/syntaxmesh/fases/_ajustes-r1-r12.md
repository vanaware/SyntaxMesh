# Ajustes R1–R12 — Checklist

## R1 — ADR 013 `compat.keepRubyBugs` ✅

- [x] Arquivo `docs/syntaxmesh/decisoes/013-compat-flag-ruby-bugs.md` criado (Parte 1).
- [ ] Adicionar linha `013` em `docs/syntaxmesh/decisoes/README.md`.

## R2 — Interface `PropertyLike` ✅

- [x] Arquivo `packages/core/src/model/property-like.ts` criado (Parte 3).
- [ ] Adicionar tarefa **3.1.0** em `fase-3-tarefas.md` (já está — verificar).
- [ ] Adicionar seção `4.X — Interface PropertyLike (R2)` em `fase-3-modelo-atributos.md`.

## R3 cancelado

## R4 — `fases/README.md` ✅

- [x] Arquivo criado (Parte 2).

## R5 — Política de migração de bugs ✅

- [x] Seção "Política de migração (R5)" na ADR 013 (Parte 1).

## R6 — Convenções git ✅

- [x] Seção "Convenções git (R6)" em `fases/README.md` (Parte 2).
- [ ] Opcional: criar `.gitmessage` com template.

## R7 — Smoke test por fase ✅

- [x] Seção "Smoke tests por fase (R7)" em `fases/README.md` (Parte 2).
- [ ] Tarefa `3.15.7` já cobre Fase 3 (verificar).
- [ ] Adicionar tarefas equivalentes em Fases 4–21.

## R8 — Revisar `packages/core/mod.ts` exports ✅

- [ ] Tarefa `3.1.18` já cobre (verificar).
- [ ] Adicionar tarefa genérica em cada fase: "Re-exportar em `packages/core/mod.ts`".

## R9 — Auditoria de completude ✅

- [x] Seção "Auditoria de completude (R9)" em `fases/README.md` (Parte 2).
- [ ] Tarefa `3.15.8` já cobre (verificar).
- [ ] Adicionar `deno task audit:phase N` (futuro, opcional).

## R10 — Formato de tarefas ✅

- [x] Seção "Formato de tarefa (R10)" em `fases/README.md` (Parte 2).

## R11 — Golden tests `keepRubyBugs: false` ✅

- [ ] Tarefa `5.14.R.3` já cobre (verificar em `fase-2-tarefas-complementar1.md`).
- [ ] Documentado na ADR 013 (Parte 1).

## R12 — Corrigir numeração em `fase-3-modelo-atributos.md` ⚠️

- [ ] Localizar todas as ocorrências de `### 6.X` no plano e renomear para `### 3.X`.
- [ ] Localizar `**Bloco A** (6.0–6.2)` e ajustar para `(3.0–3.2)`.
- [ ] Atualizar `## 6. Ordem de execução sugerida` — trocar `6.x` por `3.x`.
- [ ] Atualizar `## 11. ADR 013 (referência rápida)` — verificar se aponta para o arquivo correto.

**Comandos úteis:**

```bash
# Ver ocorrências a corrigir
grep -n "### 6\." docs/syntaxmesh/fases/fase-3-modelo-atributos.md
grep -n "6\.[0-9]" docs/syntaxmesh/fases/fase-3-modelo-atributos.md | grep -v "6\.0" | head

# Após corrigir:
grep -n "### [0-9]" docs/syntaxmesh/fases/fase-3-modelo-atributos.md
```

## Verificação final

- [ ] `deno task check-all` verde.
- [ ] `git tag phase-1-done` (se Fase 1 fechou).
- [ ] Adicionar `docs/syntaxmesh/fases/_ajustes-r1-r12.md` na lista de exclusão do `.gitignore` (arquivo temporário).

---

**Última atualização:** 2026-09-12