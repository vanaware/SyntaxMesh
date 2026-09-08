import { JSX } from "preact";

// 🔥 Declaração Global Centralizada para a API Nativa do BarcodeDetector
declare global {
  class BarcodeDetector {
    constructor(options?: { formats: string[] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detect(image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<any[]>;
    static getSupportedFormats(): Promise<string[]>;
  }
}


declare module "preact" {
  namespace JSX {
    type MdElement = JSX.HTMLAttributes<HTMLElement> & {
      value?: string | number;
      checked?: boolean;
      selected?: boolean; // 🔥 ARQUITETURA: Adicionado suporte para md-switch, md-tabs, etc.
      disabled?: boolean;
      label?: string;
      placeholder?: string;
      slot?: string;
      onInput?: (e: Event) => void;
      onChange?: (e: Event) => void;
    };

    interface IntrinsicElements {
      "md-filled-button": MdElement;
      "md-outlined-button": MdElement;
      "md-text-button": MdElement;
      "md-filled-tonal-button": MdElement;
      "md-icon-button": MdElement;
      "md-filled-icon-button": MdElement;
      "md-fab": MdElement;
      "md-extended-fab": MdElement;
      "md-elevated-card": MdElement;
      "md-filled-card": MdElement;
      "md-outlined-card": MdElement;
      "md-filled-text-field": MdElement;
      "md-outlined-text-field": MdElement;
      "md-checkbox": MdElement;
      "md-radio": MdElement;
      "md-switch": MdElement;
      "md-list": MdElement;
      "md-list-item": MdElement;
      "md-divider": MdElement;
      "md-menu": MdElement & { anchor?: string; positioning?: string; open?: boolean };
      "md-menu-item": MdElement;
      "md-dialog": MdElement & { open?: boolean };
      "md-assist-chip": MdElement;
      "md-filter-chip": MdElement;
      "md-input-chip": MdElement;
      "md-suggestion-chip": MdElement;
      "md-circular-progress": MdElement & { indeterminate?: boolean };
      "md-linear-progress": MdElement & { indeterminate?: boolean };
      "md-icon": MdElement;
      "md-tabs": MdElement;
      "md-primary-tab": MdElement;
      "md-secondary-tab": MdElement;
      "md-filled-select": MdElement;
      "md-outlined-select": MdElement;
      "md-select-option": MdElement;
    }
  }
}