// Arquivo: monorepo/ui/src/app.tsx
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { effect } from '@preact/signals';
import type { ComponentType } from 'preact';

// Componentes da Interface (App Shell & Rotas)
import { AppSidebar } from './components/AppSidebar.tsx';
import { MainHeader } from './components/MainHeader.tsx';
import { ChatSection } from './components/ChatSection.tsx';
import { ContactDetailSection } from './components/ContactDetailSection.tsx';
import { AdvancedSection } from './components/AdvancedSection.tsx';
import { ProfileSection } from './components/ProfileSection.tsx';
import { LogoutSection } from './components/LogoutSection.tsx';
import { ShareSection } from './components/ShareSection.tsx';
import { SettingsSection } from './components/SettingsSection.tsx';
import { ToastSnackbar } from './components/ToastSnackbar.tsx';
import { WebTorrentLabsSection } from './components/WebTorrentLabsSection.tsx';

// Signals e Lógica de Negócio
import { addDebugLog, currentMobileView, contatoSelecionado, contatoCompartilharHash, appTheme, AppTheme } from './stores/state.ts';
import { profile, initProfileStore, initContatosStore, initMensagensStore, initTorrentLabsStore, contatosComHash } from './stores/mod.ts';
import { isCarregandoContatos } from './stores/contatosStore.ts';
import { loadAllConfigs, getConfigValue } from './stores/config-store.ts';

// 🔥 ARQUITETURA: Importar initializeUiEventAdapter para garantir que a UI
// escute os eventos do SW desde o carregamento, mesmo sem criar perfil novo.
import { registrarServiceWorker } from '@loco/service-worker/utils';

// Roteador Reativo
import { activeView, navigate } from './stores/router.ts';

import "@material/web";
import './styles.css';

effect(() => {
  if (typeof document !== 'undefined') {
    const theme = appTheme.value;
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
});

const HomePlaceholder = () => (
  <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; color: var(--md-sys-color-on-surface-variant);">
    <div style="text-align: center;">
      <md-icon style="font-size: 4rem; opacity: 0.3;">forum</md-icon>
      <p style="font-size: 0.9rem;">Clique em um contato na barra lateral<br/>para conversar ou ver seu cartão de indicação.</p>
    </div>
  </div>
);

const PushAlertBanner = () => {
  const p = profile.value;
  const _view = activeView.value;
  if (!p || !p.name) return null;
  const hasEndpoint = !!(p.subscription && p.subscription.endpoint);
  const hasPermission = 'Notification' in window && Notification.permission === 'granted';
  if (hasEndpoint && hasPermission) return null;

  return (
    <div style="background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.85rem; z-index: 50; flex-shrink: 0; border-bottom: 1px solid var(--md-sys-color-error);">
      <div style="display: flex; align-items: center; gap: 8px;">
        <md-icon style="color: var(--md-sys-color-error);">notifications_off</md-icon>
        <span><strong>Rede Incompleta:</strong> Você não pode receber notificações ou mensagens diretas.</span>
      </div>
      <md-outlined-button onClick={() => navigate('#advanced')} style="flex-shrink: 0; --md-sys-color-outline: var(--md-sys-color-on-error-container); color: var(--md-sys-color-on-error-container);">
        Corrigir
      </md-outlined-button>
    </div>
  );
};

const ViewMap: Record<string, ComponentType<any>> = {
  'chat': ChatSection,
  'detail': ContactDetailSection,
  'advanced': AdvancedSection,
  'labs': WebTorrentLabsSection,
  'profile': () => <div style="padding: 16px; display: flex; justify-content: center; overflow-y: auto;"><div style="max-width: 600px; width: 100%;"><ProfileSection/></div></div>,
  'logout': LogoutSection,
  'share': ShareSection,
  'settings': () => <div style="padding: 16px; display: flex; justify-content: center; overflow-y: auto;"><div style="max-width: 600px; width: 100%;"><SettingsSection/></div></div>,
  'home': HomePlaceholder,
};

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // 1. Registra o SW (que internamente chama initializeUiEventAdapter)
      await registrarServiceWorker();

      const savedTheme = await getConfigValue('APP_THEME');
      if (savedTheme) appTheme.value = savedTheme as AppTheme;

      addDebugLog("info", "SYSTEM", "Verificando roteamento de rede...");
      await loadAllConfigs();

      await initProfileStore();

      const isIdentityValid = !!(profile.value && profile.value.e2ePrivateKeyJwk && profile.value.name);
      const isRouteAllowedWithoutProfile = ['profile', 'advanced', 'labs', 'settings', 'logout'].includes(activeView.value);
      if (!isIdentityValid && !isRouteAllowedWithoutProfile) {
        navigate('#profile');
      }

      await initContatosStore();
      await initMensagensStore();
      await initTorrentLabsStore();

      setIsLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    if (!isLoading && !isCarregandoContatos.value && (activeView.value === 'chat' || activeView.value === 'detail')) {
      const hashAlvo = activeView.value === 'chat' ? contatoSelecionado.value : contatoCompartilharHash.value;
      if (hashAlvo) {
        const contatoExiste = contatosComHash.value.some(c => c.hash === hashAlvo);
        if (!contatoExiste) {
          addDebugLog("warn", "ROUTER", "Tentativa de acesso a contato inexistente/excluído. Redirecionando para Home.");
          navigate('');
        }
      }
    }
  }, [isLoading, isCarregandoContatos.value, activeView.value, contatoSelecionado.value, contatoCompartilharHash.value, contatosComHash.value]);

  if (isLoading) {
    return (
      <div style="display: flex; height: 100vh; justify-content: center; align-items: center;">
        <md-circular-progress indeterminate></md-circular-progress>
      </div>
    );
  }

  const isIdentityValid = !!(profile.value && profile.value.e2ePrivateKeyJwk && profile.value.name);
  const isRouteAllowedWithoutProfile = ['profile', 'advanced', 'labs', 'settings', 'logout'].includes(activeView.value);
  const viewToRender = (!isIdentityValid && !isRouteAllowedWithoutProfile) ? 'profile' : activeView.value;

  const contatoAtivo = contatosComHash.value.find(c => c.hash === contatoSelecionado.value)?.contato;
  const contatoDetalhesAtivo = contatosComHash.value.find(c => c.hash === contatoCompartilharHash.value)?.contato;
  const isOrphanChat = (activeView.value === 'chat' && !contatoAtivo) || (activeView.value === 'detail' && !contatoDetalhesAtivo);

  const RouteComponent = isOrphanChat ? ViewMap['home']! : (ViewMap[viewToRender] || ViewMap['home']!);

  return (
    <div style="display: flex; flex-direction: column; height: 100vh; height: 100dvh; width: 100vw; overflow: hidden;">
      <PushAlertBanner />
      <div id="app-root" class={`view-mode-${currentMobileView.value}`} style="flex-grow: 1; display: flex; position: relative; min-height: 0;">
        <AppSidebar isIdentityValid={isIdentityValid} />
        <main class="app-main">
          <MainHeader />
          <RouteComponent/>
        </main>
      </div>
      <ToastSnackbar/>
    </div>
  );
}

const root = document.getElementById('app');
if (root) {
  render(<App/>, root);
}