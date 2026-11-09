// Counter island in pure HTML+ES form (runs directly in the browser)
// Uses the utilities exported by the mdBlog bundle (no external CDN requests)
import {
  html as _html,
  signal as _signal,
  useSignal as _useSignal,
} from "../mdblog.js";

const html = _html ||
  (typeof globalThis !== "undefined" ? globalThis.mdBlog?.html : null);
const signal = _signal ||
  (typeof globalThis !== "undefined" ? globalThis.mdBlog?.signal : null);
const useSignal = _useSignal ||
  (typeof globalThis !== "undefined" ? globalThis.mdBlog?.useSignal : null);

export function Counter(
  { start = 0, step = 1, label = "Interactive Counter", },
) {
  const count = typeof useSignal === "function"
    ? useSignal(Number(start,),)
    : signal(Number(start,),);

  return html`
    <article class="border round padding surface-container-low margin">
      <!-- .row already centers its children and a .max child is the spacer that
          pushes the actions to the end: justify-between and gap-* are not part of
          the BeerCSS vocabulary. -->
      <div class="row wrap">
        <div class="max wrap">
          <h6 class="no-margin bold small wrap">${label}</h6>
          <p class="small-text secondary-text no-margin wrap">
            HTML+ES island (native run with Preact Signals from the bundle)
          </p>
        </div>
        <div class="row">
          <button
            class="circle small surface-variant"
            onClick=${() => (count.value -= Number(step,))}
            aria-label="Decrease"
          >
            <i>remove</i>
          </button>
          <span class="chip primary bold center-align">
            ${count.value}
          </span>
          <button
            class="circle small primary"
            onClick=${() => (count.value += Number(step,))}
            aria-label="Increase"
          >
            <i>add</i>
          </button>
          <button
            class="circle small transparent"
            onClick=${() => (count.value = Number(start,))}
            title="Reset"
            aria-label="Reset"
          >
            <i>refresh</i>
          </button>
        </div>
      </div>
    </article>
  `;
}

export default Counter;
