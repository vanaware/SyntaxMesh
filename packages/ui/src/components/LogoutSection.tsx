// src/components/LogoutSection.tsx
import { useSignal } from '@preact/signals';
import { navigate } from '../stores/router.ts';

export function LogoutSection() {
  const status = useSignal('Aguardando confirmação...');
  const executando = useSignal(false);

  const handleLogout = async () => {
    executando.value = true;
    try {
      status.value = "1/4 Limpando Web Storage e Cookies...";
      window.localStorage.clear();
      window.sessionStorage.clear();

      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookieStr = cookies[i];
        if (!cookieStr) continue;
        const parts = cookieStr.split("=");
        const part0 = parts[0];
        if (!part0) continue;
        const name = part0.trim();
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
      }

      status.value = "2/4 Apagando bancos IndexedDB...";
      if (window.indexedDB?.databases) {
        const dbs = await window.indexedDB.databases();
        for (const db of dbs) {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        }
      }

      status.value = "3/4 Limpando disco virtual (OPFS) e Caches...";
      if (window.caches) {
        const cacheNames = await window.caches.keys();
        for (const name of cacheNames) await window.caches.delete(name);
      }
      if (navigator.storage?.getDirectory) {
        try {
          const root = await navigator.storage.getDirectory();
          for await (const name of root.keys()) await root.removeEntry(name, { recursive: true });
        } catch (e) {
          console.warn("OPFS Wipe (Opcional):", e);
        }
      }

      status.value = "4/4 Desativando Push e Service Workers...";
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          if (registration.pushManager) {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) await subscription.unsubscribe();
          }
          await registration.unregister();
        }
      }

      status.value = "✅ Destruição de chaves concluída com sucesso!";
      setTimeout(() => {
        window.location.href = window.location.pathname; 
      }, 1000);
    } catch (erro: any) {
      status.value = `❌ Erro: ${erro.message}`;
      executando.value = false;
    }
  };

  return (
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 24px; overflow-y: auto;">
      <div class="container" style="border-left-color: var(--md-sys-color-error); text-align: center; max-width: 480px; width: 100%;">
        <md-icon style="font-size: 48px; color: var(--md-sys-color-error); margin-bottom: 16px;">logout</md-icon>
        <h2 style="justify-content: center;">Sair do Sistema</h2>
        
        {/* 🔥 ARQUITETURA: Uso dinâmico de cor de texto para modo escuro/claro */}
        <p style="color: var(--md-sys-color-on-surface-variant); margin-bottom: 16px; font-size: 0.95rem;">
          Tem certeza que deseja sair? Como não usamos senhas, <strong>todas as suas chaves criptográficas, contatos e histórico de mensagens</strong> serão apagados irreversivelmente deste dispositivo por segurança.
        </p>

        {executando.value ? (
          <div style="background: var(--md-sys-color-surface-variant); padding: 12px; border-radius: 8px; margin-bottom: 24px; font-size: 0.85rem; font-family: monospace;">
            <md-circular-progress indeterminate style="width: 24px; height: 24px; margin-bottom: 8px;"></md-circular-progress>
            <br />
            {status.value}
          </div>
        ) : (
          <div style="display: flex; gap: 8px; flex-direction: column; margin-top: 24px;">
            <md-filled-button onClick={handleLogout} style="width: 100%; --md-sys-color-primary: #ba1a1a; --md-sys-color-on-primary: white;">
              ⚠️ Sim, Apagar Meus Dados e Sair
            </md-filled-button>
            <md-outlined-button onClick={() => navigate('')} style="width: 100%;">
              Cancelar e Voltar
            </md-outlined-button>
          </div>
        )}
      </div>
    </div>
  );
}