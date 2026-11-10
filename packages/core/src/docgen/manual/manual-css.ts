/**
 * `manual-css.ts` — stylesheet of the manual (22.1b.5.2).
 *
 * Ruby copies `data/css/tjmanual.css` to the output directory
 * (`UserManual#generate` → `FileUtils.cp_r`). `doc-core` does not read the
 * disk, so the content comes in **as data** and is returned along with the
 * pages: whoever writes `css/tjmanual.css` is the CLI, together with the rest
 * of the manual.
 *
 * Content identical to the `assets/css/tjmanual.css` asset at the repository
 * root — changes to either copy must be synchronized (the
 * `user_manual_test.ts` test compares both to prevent drift).
 *
 * @see assets/css/tjmanual.css
 */

/** File name inside the output directory of the manual. */
export const MANUAL_STYLESHEET_NAME = "css/tjmanual.css";

/** Stylesheet of the manual, byte for byte equal to the root asset. */
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
