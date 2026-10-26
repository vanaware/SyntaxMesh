/**
 * Navigator — valor mínimo (Fase 10).
 *
 * O parser (subfase 10.14.5.4) constrói Navigator objects ao processar a
 * diretiva `navigator`. A geração da barra de navegação pertence à Fase 17
 * (HTML/XML); aqui guardamos id/projeto/hideReport para fidelidade de parse.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Navigator.rb
 */
import type { Project, } from "../model/project.ts";
import type { LogicalExpression, } from "../logical/logical-expression.ts";

export class Navigator {
  hideReport: LogicalExpression | null = null;

  constructor(readonly id: string, readonly project: Project,) {}
}
