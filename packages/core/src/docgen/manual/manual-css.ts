/**
 * `manual-css.ts` — folha de estilos do manual (22.1b.5.2).
 *
 * O Ruby copia `data/css/tjmanual.css` para o diretório de saída
 * (`UserManual#generate` → `FileUtils.cp_r`). O `doc-core` não lê disco, então
 * o conteúdo entra **como dado** e é devolvido junto com as páginas: quem grava
 * `css/tjmanual.css` é a CLI, junto com o resto do manual.
 *
 * Conteúdo idêntico ao asset `assets/css/tjmanual.css` da raiz do repositório
 * — mudanças nas duas cópias precisam ser sincronizadas (o teste
 * `user_manual_test.ts` compara os dois para evitar deriva).
 *
 * @see assets/css/tjmanual.css
 */

/** Nome do arquivo dentro do diretório de saída do manual. */
export const MANUAL_STYLESHEET_NAME = "css/tjmanual.css";

/** Folha de estilos do manual, byte a byte igual ao asset da raiz. */
export const MANUAL_STYLESHEET = `pre {
  font-size:16px;
  font-family: Courier;
  padding-left:8px;
  padding-right:8px;
  padding-top:0px;
  padding-bottom:0px;
}
p {
  margin-top:8px;
  margin-bottom:8px;
}
code {
  font-size:16px;
  font-family: Courier;
}
.table {
  background-color:#ABABAB;
  width:100%;
}
.tag {
  background-color:#E0E0F0;
  font-size:16px;
  font-weight:bold;
  padding-left:8px;
  padding-right:8px;
  padding-top:5px;
  padding-bottom:5px;
}
.descr {
  background-color:#F0F0F0;
  font-size:16px;
  padding-left:8px;
  padding-right:8px;
  padding-top:5px;
  padding-bottom:5px;
}
.attrtable {
  background-color:#ABABAB;
}
.attrtag {
  background-color:#F0F0F0;
  font-family: Courier;
  padding-left:6px;
  padding-right:6px;
  padding-top:3px;
  padding-bottom:3px;
}
.attrdescr {
  background-color:#F0F0F0;
  padding-left:6px;
  padding-right:6px;
  padding-top:3px;
  padding-bottom:3px;
  width:100%;
}
.codeframe{
  border-width:2px;
  border-color:#ABABAB;
  border-style:solid;
  background-color:#F0F0F0;
  margin-top:8px;
  margin-bottom:8px;
}
.code {
  padding-left:15px;
  padding-right:15px;
  padding-top:0px;
  padding-bottom:0px;
}
div[codesection] {
  border-width:2px;
  border-color:#ABABAB;
  border-style:solid;
  background-color:#F0F0F0;
  margin-top:8px;
  margin-bottom:8px;
}
pre[codesection] {
  padding-left:15px;
  padding-right:15px;
  padding-top:0px;
  padding-bottom:0px;
}

`;
