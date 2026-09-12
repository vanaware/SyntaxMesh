# Cheat Sheet Ruby → TypeScript

> **Arquivo:** `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
> **Propósito:** mapeamento idiomático de construções Ruby para TypeScript, para uso nas tarefas de port das fases 2+.
> **Como usar:** ao portar qualquer arquivo Ruby, consulte esta tabela **primeiro**. Se aparecer um idioma não mapeado, adicione uma entrada (mantenha ordenado por categoria). Se encontrar um bug do Ruby, siga o fluxo de §12.
> **Referências:** ADR 011 (port fiel), ADR 012 (TjTime), ADR 013 (compat.keepRubyBugs).

---

## 1. Tipos e valores

| Ruby | TypeScript |
|---|---|
| `nil` | `null` (nunca `undefined` em `src/`) |
| `true` / `false` | `true` / `false` |
| `Integer` | `number` (com `Number.isInteger`) |
| `Float` | `number` |
| `String` | `string` |
| `Symbol` | `string` literal ou `enum` |
| `Array` | `T[]` ou `Array<T>` |
| `Hash` | `Map<K, V>` (preferir) ou `Record<K, V>` |
| `Struct.new(:a, :b)` | `interface X { a: T; b: U }` + factory `createX()` |
| `Set` | `Set<T>` |
| `Range` | `{ start: number; end: number }` |

## 2. Classes

| Ruby | TypeScript |
|---|---|
| `class Foo` | `class Foo` |
| `attr_reader :x` | `readonly x: T` |
| `attr_accessor :x` | `x: T` |
| `attr_writer :x` | `set x(v: T)` |
| `def initialize(...)` | `constructor(...)` |
| `private def foo` | `private foo()` |
| `protected def foo` | `protected foo()` |
| `def self.foo` / `def Foo.foo` | `static foo()` |
| `super` | `super(...)` |
| `self` (método) | `this` |
| `@@classvar` | `private static _x` + getter/setter estático |
| `@instance_var` | `private readonly x` ou `private x` |
| `module Mixin` | `interface` + funções puras, ou `mixin()` helper |
| `class Foo < Bar` | `class Foo extends Bar` |
| `include Comparable` | implementar `compareTo()` manualmente |
| `.freeze` | `Object.freeze(this)` no fim do constructor |
| `.frozen?` | `Object.isFrozen()` |
| `.dup` | `{ ...obj }` ou `.slice()` (raso) |
| `.clone` | `structuredClone(obj)` (profundo) |

## 3. Blocos e iteração

| Ruby | TypeScript |
|---|---|
| `arr.each { \|x\| ... }` | `for (const x of arr) { ... }` |
| `arr.each_with_index { \|x, i\| ... }` | `arr.forEach((x, i) => ...)` |
| `arr.map { \|x\| ... }` | `arr.map(x => ...)` |
| `arr.select { \|x\| ... }` | `arr.filter(x => ...)` |
| `arr.reject { \|x\| ... }` | `arr.filter(x => !...)` |
| `arr.find { \|x\| ... }` | `arr.find(x => ...)` |
| `arr.include?(x)` | `arr.includes(x)` |
| `arr.empty?` | `arr.length === 0` |
| `arr.first`, `arr.last` | `arr[0]`, `arr[arr.length - 1]` |
| `arr.sort`, `arr.sort_by { }` | `arr.sort((a, b) => ...)` (mutável) ou `[...arr].sort()` |
| `arr.uniq` | `[...new Set(arr)]` |
| `arr.flatten` | `arr.flat(Infinity)` |
| `arr.compact` | `arr.filter(x => x !== null)` |
| `arr.each_slice(n) { \|s\| }` | `for (let i = 0; i < arr.length; i += n)` |
| `arr.inject(0) { \|acc, x\| }` | `arr.reduce((acc, x) => ..., 0)` |
| `hash.each { \|k, v\| }` | `for (const [k, v] of map)` |
| `hash.keys`, `hash.values` | `map.keys()`, `map.values()` (iteradores) ou `[...map.keys()]` |
| `hash.has_key?(k)` | `map.has(k)` |
| `block_given?` | `fn !== undefined` |
| `yield(x)` | `fn(x)` |
| `&block` | `fn: (...) => ...` |
| `block.call(x)` | `fn(x)` |
| `1.upto(5) { \|i\| }` | `for (let i = 1; i <= 5; i++)` |
| `5.downto(1) { \|i\| }` | `for (let i = 5; i >= 1; i--)` |
| `n.times { \|i\| }` | `for (let i = 0; i < n; i++)` |

## 4. Condicionais e operadores

| Ruby | TypeScript |
|---|---|
| `x.nil?` | `x === null` (ou `x == null` para null+undefined) |
| `unless x` | `if (!x)` |
| `if x then y else z end` | `x ? y : z` |
| `x && y` (retorna valor) | `x && y` (mesma semântica) |
| `x \|\| y` (retorna valor) | `x \|\| y` (mesma) |
| `x \|\|= y` | `x ??= y` (nullish) ou `x \|\|= y` |
| `x = y if cond` | `if (cond) x = y` |
| `a <=> b` | `compareTo(a, b): -1 \| 0 \| 1` (helper) |
| `a == b` (valor) | `a === b` (primitivos) ou `.equals()` |
| `a.equal?(b)` (identidade) | `a === b` (referência) |
| `x.between?(a, b)` | `x >= a && x <= b` |
| `case x when 1 then ...` | `switch (x) { case 1: ... }` |
| `if x.is_a?(Foo)` | `x instanceof Foo` |
| `x.respond_to?(:foo)` | `typeof (x as any).foo === 'function'` (só em testes) ou type guard |
| `x.nil? ? y : x` | `x ?? y` |
| `!x.empty?` | `x.length > 0` |
| `x.to_s` | `x.toString()` |
| `x.to_i` | `Number.parseInt(x, 10)` |
| `x.to_f` | `Number.parseFloat(x)` |
| `"foo" + x` (concat) | `` `foo${x}` `` (template) |

## 5. Strings

| Ruby | TypeScript |
|---|---|
| `str.each_utf8_char` | `for (const c of str)` (itera code points) |
| `str.length_utf8` | `[...str].length` |
| `str.reverse` | `[...str].reverse().join('')` |
| `str.ljust(n, pad)` | `str.padEnd(n, pad)` |
| `str.rjust(n, pad)` | `str.padStart(n, pad)` |
| `str.strip` | `str.trim()` |
| `str.chomp` | `str.replace(/\n$/, '')` |
| `str.chomp!` | mutação: `str = str.replace(/\n$/, '')` |
| `str.gsub(re, s)` | `str.replaceAll(re, s)` (regex com flag `g`) |
| `str.gsub!(re, s)` | mutação |
| `str.sub(re, s)` | `str.replace(re, s)` |
| `str.include?(s)` | `str.includes(s)` |
| `str.index(s)` | `str.indexOf(s)` |
| `str.split(d)` | `str.split(d)` |
| `str.start_with?(p)` | `str.startsWith(p)` |
| `str.end_with?(p)` | `str.endsWith(p)` |
| `str =~ /re/` | `/re/.test(str)` |
| `str.scan(re)` | `str.matchAll(re)` (retorna iterador) |
| `"%s-%d" % [a, b]` | `` `${a}-${b}` `` |
| `format("%s", x)` | `x.toString()` + template |
| `str[0..-2]` | `str.slice(0, -1)` |
| `str[-4, 4]` | `str.slice(-4)` |
| `str[-1]` | `str[str.length - 1]` ou `str.at(-1)` |

## 6. Números

| Ruby | TypeScript |
|---|---|
| `n.abs` | `Math.abs(n)` |
| `n.floor` | `Math.floor(n)` |
| `n.ceil` | `Math.ceil(n)` |
| `n.round` | `Math.round(n)` (positivos: idêntico; negativos: ver §12) |
| `n.to_i` (trunca) | `Math.trunc(n)` |
| `n ** m` | `n ** m` (mesma sintaxe) |
| `n % m` (sempre positivo se m > 0) | `((n % m) + m) % m` para módulo positivo |
| `n.zero?` | `n === 0` |
| `rand(n)` | `Math.floor(Math.random() * n)` |
| `rand` (0..1) | `Math.random()` |
| `Float::INFINITY` | `Infinity` |
| `Float::NAN` | `NaN` |

## 7. Exceções

| Ruby | TypeScript |
|---|---|
| `raise ArgumentError, msg` | `throw new TjArgumentError(msg)` |
| `raise TjException.new, msg` | `throw new TjError(msg)` |
| `raise` (re-raise) | `throw err` |
| `begin ... rescue => e ... ensure ... end` | `try { ... } catch (e) { ... } finally { ... }` |
| `rescue Foo => e` | `catch (e) { if (e instanceof Foo) ... }` |
| `retry` | loop explícito |
| `$!` | `e` (o catch) |
| `e.message` | `(e as Error).message` |
| `e.backtrace` | `(e as Error).stack` |

## 8. Metaprogramação

| Ruby | TypeScript |
|---|---|
| `method_missing(name, *args)` | métodos explícitos (ADR 014) ou `Proxy` (desencorajado) |
| `respond_to?(:foo)` | `typeof (x as any).foo === 'function'` |
| `send(:foo, a, b)` | `(x as any).foo(a, b)` — **proibido em `src/`** |
| `instance_variable_get(:@x)` | **proibido em `src/`** — usar `AttributeContainer` (Fase 3.1) |
| `instance_variable_set(:@x, v)` | idem |
| `class_eval <<EOT ... EOT` | `class` estática (ver Fase 17, `HTMLElements`) |
| `define_method(:foo) { }` | `static foo() { }` |
| `Object.const_get(:Foo)` | `import { Foo }` explícito |
| `Hash.new { \|h, k\| ... }` | `Map` + método `getOrCreate(k)` (ADR 014) |

## 9. Arrays e Hashes (operações específicas)

| Ruby | TypeScript |
|---|---|
| `Array.new(n, default)` | `Array.from({ length: n }, () => default)` ⚠️ **cuidado com referências** |
| `Array.new(n) { \|i\| i }` | `Array.from({ length: n }, (_, i) => i)` |
| `[1,2,3].max` | `Math.max(...arr)` |
| `[1,2,3].min` | `Math.min(...arr)` |
| `[1,2,3].sum` | `arr.reduce((a, b) => a + b, 0)` |
| `arr.push(x)`, `arr << x` | `arr.push(x)` |
| `arr.pop`, `arr.shift` | `arr.pop()`, `arr.shift()` |
| `arr.slice!(i, n)` | `arr.splice(i, n)` |
| `arr.insert(i, x)` | `arr.splice(i, 0, x)` |
| `arr.each_cons(2)` | loop `for (let i = 0; i < arr.length - 1; i++)` |
| `arr.product(other)` | loops aninhados |
| `hash.sort_by { \|k, v\| v }` | `[...map.entries()].sort((a, b) => ...)` |
| `hash.map { \|k, v\| }` | `[...map.entries()].map(([k, v]) => ...)` |

## 10. Tempo e datas (TjTime.rb → Fase 2)

| Ruby | TypeScript |
|---|---|
| `Time.now` | `TjTime.now()` |
| `Time.at(secs)` | `TjTime.fromSeconds(secs)` |
| `t.to_i` (epoch) | `t.toSeconds()` |
| `t1 - t2` (segundos) | `t1.diff(t2)` |
| `t1 < t2` | `t1.lessThan(t2)` |
| `t1 == t2` | `t1.equals(t2)` |
| `t1 + 3600` | `t1.addSeconds(3600)` |
| `t.utc` | `t.utc()` |
| `t.localtime` | `t.localtime()` |
| `t.strftime("%Y-%m-%d")` | `t.strftime('%Y-%m-%d')` (implementação própria) |
| `ENV['TZ'] = zone` | `TjTime.setTimeZone(zone)` |
| `Time.local(y, m, d, h, min, s)` | `TjTime.fromParts(y, m, d, h, min, s)` |

## 11. Globais e padrões do projeto

| Padrão | Regra |
|---|---|
| `any` | ❌ proibido em `src/` |
| `as` (cast) | ⚠️ só com justificativa — preferir narrowing |
| `unknown` + type guard | ✅ preferido |
| `TjArgumentError` | validação de argumentos (Fase 2+) |
| `TjError` | erro base |
| `TjRuntimeError` | erro que interrompe pipeline |
| `NotYetImplementedError` | stub para fase futura |
| `console.log` | ❌ em `src/` (usar `Log` ou retorno) |
| `Date` direto | ❌ em `src/` (usar `TjTime`) |
| `Map` vs `Record` | `Map` quando chave dinâmica; `Record` quando chave literal |

## 12. Bugs e comportamentos estranhos do Ruby

O código Ruby do TaskJuggler 3.8.4 contém bugs conhecidos. Ao portar, **categorize cada um** em uma das 3 categorias abaixo antes de decidir o que fazer.

### Categoria A — Latentes (sempre corrigir)

Nunca disparam em uso normal. Corrigir é invisível para o usuário. Não precisam de flag.

- Adicionar comentário `// RUBY-COMPAT-FIX: <descrição>` no código TS.
- Documentar no ADR relevante (ex: ADR 012 para `TjTime`).

| Onde | Bug do Ruby | Correção |
|---|---|---|
| `Interval#combine` | Retorna `[Interval]` (Array) em 2 branches, `Interval` no 3º | Sempre `Interval` |
| `Scoreboard#idxToDate` | Typo `kdx` (variável inexistente) no branch `forceIntoProject && idx < 0` | Usar `idx` |
| `WorkingHours.@days` | 7 referências ao **mesmo** array `[]` via `Array.new(7, [])` | `Array.from({length:7}, () => [])` |

### Categoria B — Afetam output (flag global `compat.keepRubyBugs`)

> **Referência:** ADR 013 documenta a política completa.

Produzem resultados diferentes em casos legítimos. Precisam de paridade com `tj3` **e** opção de correção.

**Protocolo:**

1. Adicionar branch no método:
   ```ts
   sameTimeNextMonth(): TjTime {
     if (compat.keepRubyBugs) {
       // comportamento Ruby (bug)
     } else {
       // comportamento corrigido
     }
   }
   ```
2. Adicionar comentário `// RUBY-COMPAT: <descrição do bug>` no branch buggy.
3. Adicionar teste em **ambos os modos** (usar `compat.keepRubyBugs = false` em `beforeEach`).
4. Adicionar entrada na tabela abaixo.

| Onde | Ruby faz | Correto seria |
|---|---|---|
| `TjTime#sameTimeNextWeek` | `day += 7` com overflow de 1 mês | +7 dias exatos |
| `TjTime#sameTimeNextMonth` | Clamp em `monMax` do mês **antigo** | Clamp em `lastDayOfMonth` do novo mês |
| `TjTime#sameTimeNextQuarter` | Sem clamp (rollover via `Time.mktime`) | Clamp no último dia do novo mês |
| `TjTime#sameTimeNextYear` | Sem clamp (`29/02/2024 → 01/03/2025`) | Clamp em `28/02/2025` |
| `TjTime#to_s` (sem formato) | Usa `this.time.sec` (original) para decidir `:%S` | Usar sec local |
| `Integer#round` em `-X.5` | `-2.5.round == -3` (half-away-from-zero) | `-2` (JS native) |
| `Scoreboard#collectIntervals` | Sentinel `start === 0` perde slot 0 | Sentinel `-1` |

### Categoria C — Comportamentos documentados (sempre replicar)

**Não são bugs** — são comportamentos canônicos do Ruby documentados. Replicar sempre, sem flag.

- Adicionar comentário `// RUBY-COMPAT-DOC: <descrição>` no código TS.

| Comportamento | Justificativa |
|---|---|
| `Interval#compareTo` retorna `0` em overlap | Documentado: "only works for non-overlapping intervals" |
| `String#to_i` retorna `0` em string inválida | Canônico do Ruby (`parseInt` do JS retorna `NaN`) |
| `Time.mktime` faz rollover em dia inválido | Documentado: `mktime(2024, 4, 31)` → `2024-05-01` |
| `Integer#round` half-up em positivos | Igual a `Math.round` |
| `nil` como "infinito" em `lessThan`/`greaterThan` | Ver `TjTime.rb:120–150` |
| `ENV['TZ']` é global | Replicado via `currentTimeZone` module-level |

### Fluxo de decisão

Ao encontrar um comportamento estranho no Ruby:

```
1. É intencional / documentado?
   SIM → Categoria C: replicar + comentário RUBY-COMPAT-DOC
   NÃO → continua

2. Afeta output em casos legítimos?
   NÃO → Categoria A: corrigir + comentário RUBY-COMPAT-FIX
   SIM → Categoria B: flag compat.keepRubyBugs + teste em ambos modos

3. Adicionar entrada nas tabelas acima (mantendo a categoria certa)

4. Se afetar `TjTime`, atualizar ADR 012 na seção "Bugs do Ruby"
```

### Manutenção

- **Ao adicionar novo bug:** escolher categoria, adicionar tabela, atualizar ADR se aplicável.
- **Ao trocar categoria:** justificar em commit.
- **Bugs Categoria B nunca saem da flag** — mesmo se usuário quiser corrigir, a flag fica.

## 13. Como adicionar uma nova entrada

1. Identificar categoria (seções 1–12).
2. Se não encaixa em nenhuma, criar seção nova.
3. Ordem dentro da seção: alfabética ou por frequência.
4. Formato: `| \`Ruby\` | \`TypeScript\` |` ou `| \`Ruby\` | descrição |`.
5. Se for comportamento estranho, categorizar em §12 (A/B/C).

## 14. Manutenção

- **Cada fase que descobre novo mapeamento** deve adicionar entrada aqui.
- **Cada bug do Ruby** deve ser categorizado (A/B/C) conforme §12.
- **Revisar a cada 3 fases** para consolidar duplicatas.
- **Não criar seções para uma única entrada** — espere a segunda ocorrência.

## 15. `compat.keepRubyBugs` — como usar

A flag global vive em `packages/core/src/compat.ts`:

```ts
export const compat = {
  /**
   * Quando `true` (default), replica bugs do TaskJuggler 3.8.4 para
   * garantir paridade bit-a-bit em golden tests.
   *
   * Quando `false`, aplica comportamento corrigido.
   *
   * Categoria A: nunca respeita a flag (corrigido sempre).
   * Categoria B: respeita a flag.
   * Categoria C: nunca respeita a flag (replicado sempre).
   */
  keepRubyBugs: true,
};
```

**Uso no código:**

```ts
import { compat } from '../compat.ts';

sameTimeNextMonth(): TjTime {
  if (compat.keepRubyBugs) {
    // RUBY-COMPAT: clamp em monMax do mês antigo (bug do Ruby)
    // ...
  } else {
    // clamp em lastDayOfMonth do novo mês (correto)
    // ...
  }
}
```

**Uso nos testes:**

```ts
import { compat } from '../../src/compat.ts';

describe("TjTime.sameTimeNextMonth", () => {
  beforeEach(() => { compat.keepRubyBugs = true; });
  afterEach(() => { compat.keepRubyBugs = true; }); // sempre resetar

  it("com keepRubyBugs=true replica bug", () => {
    compat.keepRubyBugs = true;
    // ...
  });

  it("com keepRubyBugs=false corrige bug", () => {
    compat.keepRubyBugs = false;
    // ...
  });
});
```

**Regras:**

- **Default é sempre `true`.** Produção pode trocar para `false` no entry point (`main.tsx`).
- **Golden tests nunca trocam a flag.** Rodam com default.
- **Testes de unidade** testam **ambos** os modos quando o método é Categoria B.
- **`beforeEach`/`afterEach` sempre resetam** para `true` para evitar vazamento entre testes.

---

**Fim do cheat sheet.**