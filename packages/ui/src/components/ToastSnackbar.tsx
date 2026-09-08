// src/components/ToastSnackbar.tsx
import { toastState } from '../stores/state.ts';

export function ToastSnackbar() {
  const state = toastState.value;
  if (!state.visible) return null;

  // Cores adaptadas ao padrão MD3 com base no tipo de mensagem
  let background = 'var(--md-sys-color-inverse-surface, #2e312e)';
  let color = 'var(--md-sys-color-inverse-on-surface, #eff1ed)';
  let iconName = 'info';

  if (state.type === 'success') {
    background = 'var(--md-sys-color-primary-container, #8cf0cf)';
    color = 'var(--md-sys-color-on-primary-container, #002114)';
    iconName = 'check_circle';
  } else if (state.type === 'error') {
    background = 'var(--md-sys-color-error-container, #ffdad6)';
    color = 'var(--md-sys-color-on-error-container, #410002)';
    iconName = 'error';
  }

  return (
    <div style={`
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background-color: ${background};
      color: ${color};
      padding: 12px 20px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      font-size: 0.9rem;
      max-width: 90vw;
      width: auto;
      animation: fadeIn 0.25s cubic-bezier(0.2, 0, 0, 1);
    `}>
      <md-icon style="font-size: 1.2rem; flex-shrink: 0;">{iconName}</md-icon>
      <span style="word-break: break-word; line-height: 1.3;">{state.message}</span>
    </div>
  );
}