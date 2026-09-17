/**
 * Interface para o container que armazena valores de atributos.
 *
 * O valor de um atributo nunca mora no próprio `AttributeBase` — é sempre
 * armazenado em um `AttributeContainer`. Isso permite herança e cenários
 * sem copiar dados.
 *
 * Implementações:
 * - `PropertyTreeNode` (Fase 4) para atributos não-escopo
 * - `ScenarioData` (Fase 7) para atributos específicos de cenário
 */
export interface AttributeContainer {
  /**
   * Obtém o valor armazenado para um atributo.
   *
   * @param attributeId - ID do atributo (ex: "effort")
   * @returns O valor armazenado ou `undefined` se não definido
   */
  getStoredValue(attributeId: string,): unknown;

  /**
   * Armazena um valor para um atributo.
   *
   * @param attributeId - ID do atributo (ex: "effort")
   * @param value - Valor a ser armazenado
   */
  setStoredValue(attributeId: string, value: unknown,): void;
}
