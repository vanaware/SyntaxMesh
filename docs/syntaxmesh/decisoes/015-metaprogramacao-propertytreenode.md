# 015 — Metaprogramação em PropertyTreeNode

## Contexto

O `PropertyTreeNode.rb` do TaskJuggler usa **duas formas de metaprogramação** que não têm equivalente direto em TypeScript:

### 1. `Hash.new { |h, k| ... }` — lazy attribute creation

O `@attributes` é um `Hash` com um bloco default que **cria o atributo sob demanda** quando acessado:

```ruby
@attributes = Hash.new do |hash, key|
  if (aDef = attributeDefinition(key))
    hash[key] = aDef.objClass.new(self, aDef, self)
  else
    raise TjException.new, "Unknown attribute #{key}"
  end
end
```

Isso permite `@attributes[id]` ser transparente: o `PropertyTreeNode` nunca precisa saber **quais** atributos existem — só consulta o `attributeDefinition(id)` e cria.

O mesmo padrão aparece em `@scenarioAttributes[scenarioIdx]`, mas com um bloco default diferente (busca no `ScenarioData`).

### 2. `method_missing` — delegação automática

O `PropertyTreeNode` delega métodos não encontrados para o `ScenarioData` do cenário ativo:

```ruby
def method_missing(name, *args, &block)
  if @data[@scenarioIdx]
    @data[@scenarioIdx].send(name, *args, &block)
  else
    super
  end
end
```

Isso permite `task.readyForScheduling?(scIdx)` ser resolvido automaticamente para `task.scenarioData(scIdx).readyForScheduling?()`.

O `PTNProxy.rb` usa `method_missing` de forma similar para delegar ao `PropertyTreeNode` original.

**Problema:** TypeScript não tem `Hash.new { }` nem `method_missing`. Precisamos decidir como adaptar essas duas metaprogramações sem perder a semântica.

**Alternativas consideradas para lazy creation:**

- **A) `Proxy` no `PropertyTreeNode`.** Intercepta acessos a atributos. Fiel ao Ruby, mas complexo de debugar e de tipar.
- **B) Método explícito `attribute(id)`.** Cada acesso a atributo passa por um método que cria sob demanda. Explícito, testável.
- **C) Inicialização antecipada.** Criar todos os ~40 atributos no construtor. Simples, mas desperdiça memória (~40 × milhares de propriedades).
- **D) `Map` com getter customizado.** Não resolve a criação sob demanda automaticamente.

**Alternativas consideradas para `method_missing`:**

- **E) `Proxy` no `PropertyTreeNode`.** Intercepta chamadas de método. Fiel ao Ruby, mas mesmos problemas de A.
- **F) Métodos explícitos nas subclasses.** Cada subclasse (`TaskScenario`, `ResourceScenario`) define os métodos que delegam. Mais código, mas explícito.
- **G) Helper `scenarioData(scIdx)`.** Expõe `this.data[scIdx]` publicamente; subclasses chamam `this.scenarioData(scIdx).<method>()`. Compromisso.
- **H) `Object.defineProperty` dinâmico.** Gera métodos em runtime. Complexo, foge do TS idiomático.

## Decisão

### Lazy creation → método `attribute(id)` (alternativa B)

Em vez de `Hash.new { }`, expomos um método explícito:

```ts
class PropertyTreeNode implements AttributeContainer {
  private attributes = new Map<string, AttributeBase<unknown>>();

  /**
   * Retorna (criando sob demanda) o atributo não-scenario-specific `id`.
   */
  attribute(id: string): AttributeBase<unknown> {
    let attr = this.attributes.get(id);
    if (attr === undefined) {
      const aDef = this.attributeDefinition(id);
      if (!aDef) {
        throw new TjArgumentError(`Unknown attribute ${id}`);
      }
      attr = new aDef.objClass(this, aDef, this);
      this.attributes.set(id, attr);
    }
    return attr;
  }

  /**
   * Retorna (criando sob demanda) o atributo scenario-specific `id`.
   */
  private scenarioAttribute(scIdx: number, id: string): AttributeBase<unknown> {
    let attr = this.scenarioAttributes[scIdx]!.get(id);
    if (attr === undefined) {
      const aDef = this.attributeDefinition(id);
      if (!aDef) throw new TjArgumentError(`Unknown attribute ${id}`);
      if (!aDef.scenarioSpecific) throw new TjArgumentError(...);
      attr = new aDef.objClass(this, aDef, this.data[scIdx]!);
      this.scenarioAttributes[scIdx]!.set(id, attr);
    }
    return attr;
  }
}
```

Os métodos públicos (`get`, `set`, `force`, `provided`, `inherited`) usam `attribute(id)` internamente:

```ts
get(id: string): unknown {
  return this.attribute(id).get();
}
```

### `method_missing` → helper `scenarioData(scIdx)` (alternativa G)

Em vez de interceptar métodos inexistentes, subclasses **definem métodos explícitos** que delegam:

```ts
class Task extends PropertyTreeNode {
  scenarioData(scIdx: number): TaskScenario {
    return this.data[scIdx] as TaskScenario;
  }

  // Método delegado explícito (Fase 7)
  readyForScheduling?(scIdx: number): boolean {
    return this.scenarioData(scIdx).readyForScheduling?();
  }

  schedule(scIdx: number): boolean {
    return this.scenarioData(scIdx).schedule();
  }
}
```

**Regras:**

- `scenarioData(scIdx)` é o helper público que substitui `method_missing`.
- Subclasses **não** sobrescrevem `data[]` diretamente — sempre via `scenarioData(scIdx)`.
- Métodos que precisam delegar são **declarados explicitamente** na subclasse.
- O `PTNProxy` (Fase 4, subfase 7.9) **não** usa `Proxy` — implementa os métodos delegados manualmente.

## Consequências

### Positivas

- **Explícito e debugável:** stack traces mostram o método real, não um `Proxy`.
- **Tipagem forte:** `scenarioData(scIdx)` pode ter retorno tipado por subclasse (`TaskScenario`, `ResourceScenario`, etc.).
- **Sem overhead de `Proxy`:** nada de traps em runtime.
- **Testabilidade:** cada método pode ser testado isoladamente.
- **Compatível com deno lint:** sem `any` implícito.

### Negativas / Riscos

- **Mais código:** cada subclasse precisa declarar métodos delegados.
  - **Mitigação:** aceito — a verbosidade é o preço da clareza.
- **Menos transparente:** `task.readyForScheduling?(scIdx)` no Ruby vira `task.readyForScheduling?(scIdx)` em TS — mesma assinatura, mas o desenvolvedor precisa saber que existe um método delegado.
  - **Mitigação:** documentado em cada subclasse.
- **`Proxy` não é usado em nenhum lugar do projeto.**
  - **Regra:** se um caso futuro parecer precisar de `Proxy`, **parar e consultar o autor** antes de implementar.

### Neutras / Observações

- **`AttributeContainer` permanece:** `PropertyTreeNode` e `ScenarioData` implementam `getStoredValue`/`setStoredValue`, e o `AttributeBase` continua armazenando valores neles. Isso **não muda**.
- **`attribute(id)` é `public`:** necessário porque `ScenarioData.attribute(id)` delega para o `PropertyTreeNode` pai.
- **`scenarioAttribute(scIdx, id)` é `private`:** só o `PropertyTreeNode` cria atributos scenario-specific.
- **`data[scIdx]` é `readonly`** e sempre do tipo `ScenarioData` (não `ScenarioData | null`) após o construtor rodar. Subclasses fazem narrowing via `scenarioData(scIdx)`.
- **`PTNProxy`** (Fase 4, subfase 7.9) **não** usa `Proxy` — expõe métodos delegados manualmente (`get`, `set`, `level`, `isChildOf?`, `getIndicies`, `logicalId`).
- Ver `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb` para o `Hash.new` original.
- Ver `docs/taskjuggler/lib/taskjuggler/PTNProxy.rb` para o `method_missing` do proxy.

---

**Status:** Aceito
**Data:** 2026-09-12
**Autor(es):** Vanaware
**Relacionado:** ADR 014 (attribute mode), ADR 012 (TjTime)