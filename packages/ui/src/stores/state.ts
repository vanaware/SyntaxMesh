// src/signals/state.ts
import { signal } from '@preact/signals';
import { addDebugLog as emitLog } from '@loco/utils/debug';

export type AppTheme = 'system' | 'light' | 'dark';

export const appTheme = signal<AppTheme>('system');
export const currentMobileView = signal<'list' | 'chat' | 'profile'>('list');

export const contatoSelecionado = signal<string>('');
export const contatoCompartilharHash = signal<string | null>(null); 
export const showAdvanced = signal<boolean>(false);
export const mensagemEnvio = signal<string>('');

// 🔥 Novo Signal para carregar dados de convite da URL
export const sharePayload = signal<string | null>(null);

export const profileInput = signal<string>('');
export const profileName = signal<string>('');
export const profileEmail = signal<string>('');

export interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

export const toastState = signal<ToastState>({
  message: '',
  type: 'info',
  visible: false,
});

let toastTimer: number | null = null;

export function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info'): void {
  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastState.value = {
    message: msg,
    type,
    visible: true,
  };

  toastTimer = setTimeout(() => {
    toastState.value = { ...toastState.value, visible: false };
  }, 3500) as unknown as number;
}

export function addDebugLog(
  typeOrMsg: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  moduleOrDetails?: any,
  message?: string,
  details?: unknown
): void {
  emitLog(typeOrMsg, moduleOrDetails, message, details);
}

export function clearDebugLogs(): void {}