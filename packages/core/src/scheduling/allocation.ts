import { TjArgumentError, } from "../attributes/errors.ts";
import { ShiftAssignments, } from "./shift-assignments.ts";
import { Resource, } from "../model/resource.ts";

/**
 * Modos de seleção de candidatos para alocação de recursos.
 *
 * Corresponde aos modos de seleção do Ruby `Allocation#setSelectionMode`:
 * 0 : 'order'        — seleciona na ordem da lista
 * 1 : 'minallocated' — seleciona o candidato com menor probabilidade de alocação
 * 2 : 'minloaded'    — seleciona o candidato com menor carga alocada
 * 3 : 'maxloaded'    — seleciona o candidato com maior carga alocada
 * 4 : 'random'       — seleciona um candidato aleatório
 *
 * Fonte Ruby: `docs/taskjuggler/lib/taskjuggler/Allocation.rb`
 */
export enum SelectionMode {
  Order = 0,
  MinAllocated = 1,
  MinLoaded = 2,
  MaxLoaded = 3,
  Random = 4,
}

/**
 * Representa como recursos são alocados a uma tarefa.
 *
 * Cada `Allocation` contém uma lista não vazia de recursos candidatos. Para
 * cada slot de tempo, um candidato será selecionado se algum estiver
 * disponível. Um `selectionMode` controla a ordem em que os recursos são
 * verificados quanto à disponibilidade. O primeiro disponível é selecionado.
 *
 * Fonte Ruby: `docs/taskjuggler/lib/taskjuggler/Allocation.rb`
 */
export class Allocation {
  readonly candidates: Resource[];
  selectionMode: SelectionMode;
  atomic: boolean;
  persistent: boolean;
  mandatory: boolean;
  shifts: ShiftAssignments | null;
  lockedResource: Resource | null;
  protected staticCandidates: Resource[] | null;

  constructor(
    candidates: Resource[],
    selectionMode: SelectionMode = SelectionMode.MinAllocated,
    persistent: boolean = false,
    mandatory: boolean = false,
    atomic: boolean = false,
  ) {
    if (candidates.length === 0) {
      throw new TjArgumentError(
        "Allocation candidates list must contain at least one resource",
      );
    }
    this.candidates = candidates;
    this.selectionMode = selectionMode;
    this.atomic = atomic;
    this.persistent = persistent;
    this.mandatory = mandatory;
    this.shifts = null;
    this.lockedResource = null;
    this.staticCandidates = null;
  }

  /**
   * Define o modo de seleção pelo nome.
   *
   * @param str — um dos nomes: `order`, `minallocated`, `minloaded`, `maxloaded`, `random`.
   * @throws TjArgumentError se o modo não for reconhecido.
   */
  setSelectionMode(str: string): void {
    const modes = [
      "order",
      "minallocated",
      "minloaded",
      "maxloaded",
      "random",
    ];
    const idx = modes.indexOf(str);
    if (idx === -1) {
      throw new TjArgumentError(`Unknown selection mode ${str}`);
    }
    this.selectionMode = idx as SelectionMode;
  }

  /**
   * Adiciona outro candidato à lista de candidatos.
   */
  addCandidate(candidate: Resource): void {
    this.candidates.push(candidate);
  }

  /**
   * Retorna true se não houver shifts definidos ou se os shifts definidos
   * estiverem ativos no índice do scoreboard dado.
   */
  onShift(sbIdx: number): boolean {
    if (this.shifts) {
      return this.shifts.onShift(sbIdx);
    }
    return true;
  }

  /**
   * Retorna a lista de candidatos ordenada de acordo com o `selectionMode`.
   *
   * Para `MinAllocated` e `!persistent`, a lista ordenada é cacheada em
   * `staticCandidates` para eficiência.
   */
  candidatesList(scenarioIdx: number = 0): Resource[] {
    // Se já temos a lista estática cacheada, retorna ela.
    if (this.staticCandidates) {
      return this.staticCandidates;
    }

    // Ordem de declaração ou scenarioIdx undefined: retorna como está.
    if (this.selectionMode === SelectionMode.Order) {
      return this.candidates;
    }

    // Random: embaralha com Math.random.
    if (this.selectionMode === SelectionMode.Random) {
      const shuffled = [...this.candidates];
      shuffled.sort(() => Math.random() - 0.5);
      return shuffled;
    }

    // Minallocated / MinLoaded / MaxLoaded: ordena por criticalness ou bookedEffort.
    const list = [...this.candidates].sort((x, y) => {
      if (this.selectionMode === SelectionMode.MinAllocated) {
        if (this.persistent) {
          // Para recursos persistentes, usa bookedEffort como critério primário.
          const cmp =
            x.bookedEffort(scenarioIdx) - y.bookedEffort(scenarioIdx);
          if (cmp !== 0) {
            return cmp;
          }
          // Em caso de empate, usa criticalness.
          const xCrit = x.scenarioData(scenarioIdx).a("criticalness") as number ?? 0;
          const yCrit = y.scenarioData(scenarioIdx).a("criticalness") as number ?? 0;
          return xCrit - yCrit;
        }
        // Para recursos não persistentes, usa criticalness.
        const xCrit = x.scenarioData(scenarioIdx).a("criticalness") as number ?? 0;
        const yCrit = y.scenarioData(scenarioIdx).a("criticalness") as number ?? 0;
        return xCrit - yCrit;
      }
      if (this.selectionMode === SelectionMode.MinLoaded) {
        return x.bookedEffort(scenarioIdx) - y.bookedEffort(scenarioIdx);
      }
      if (this.selectionMode === SelectionMode.MaxLoaded) {
        return y.bookedEffort(scenarioIdx) - x.bookedEffort(scenarioIdx);
      }
      throw new TjArgumentError(`Unknown selection mode ${this.selectionMode}`);
    });

    // Cacheia apenas para MinAllocated && !persistent.
    if (this.selectionMode === SelectionMode.MinAllocated && !this.persistent) {
      this.staticCandidates = list;
    }

    return list;
  }
}
