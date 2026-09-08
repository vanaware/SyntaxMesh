// src/components/SettingsSection.tsx
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { loadAllConfigs, saveConfig, resetConfig } from '../stores/config-store.ts';
import { showToast, appTheme, AppTheme } from '../stores/state.ts';
import { navigate } from '../stores/router.ts';
import { buildProxyUrl, pingProxy } from '@loco/utils/config';

export function SettingsSection() {
  const proxyPath = useSignal('');
  const isSaving = useSignal(false);
  const isTesting = useSignal(false);
  const hasChanges = useSignal(false);
  const serverStatus = useSignal<'unknown' | 'ok' | 'error'>('unknown');
  
  // 🔥 ARQUITETURA: State consolidado refletindo as rotas exatas do Worker
  const previewUrls = useSignal({ push: '', ping: '', publicKey: '' });
  
  useEffect(() => {
    const load = async () => {
      const config = await loadAllConfigs();
      proxyPath.value = config.proxy_path || '';
      await updatePreview(config.proxy_path || '');
    };
    load();
  }, []);
  
  const updatePreview = async (path: string) => {
    // 🔥 ARQUITETURA: Resolução semântica. O componente pede as rotas corretas diretamente.
    previewUrls.value = {
      push: await buildProxyUrl('/push', path),
      ping: await buildProxyUrl('/ping', path),
      publicKey: await buildProxyUrl('/publickey', path)
    };
    serverStatus.value = 'unknown';
  };

  const handleProxyPathChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    proxyPath.value = target.value;
    hasChanges.value = true;
    updatePreview(target.value);
  };

  const handleThemeChange = async (e: Event) => {
    const val = (e.target as any).value as AppTheme;
    if (val) {
      appTheme.value = val;
      await saveConfig('APP_THEME', val);
      showToast('Tema atualizado!', 'success');
    }
  };
  
  const handleTestarConexao = async () => {
    isTesting.value = true;
    const path = proxyPath.value.trim() === '' ? '/' : proxyPath.value.trim();
    
    try {
      const isAlive = await pingProxy(path);
      if (isAlive) {
        serverStatus.value = 'ok';
        showToast('✅ Servidor detectado com sucesso!', 'success');
      } else {
        serverStatus.value = 'error';
        showToast('❌ Servidor não respondeu ou não é um Loco Proxy.', 'error');
      }
    } catch {
      serverStatus.value = 'error';
      showToast('❌ Falha na conexão de rede.', 'error');
    } finally {
      isTesting.value = false;
    }
  };

  const handleSalvar = async () => {
    const path = proxyPath.value.trim() === '' ? '/' : proxyPath.value.trim();
    isSaving.value = true;
    
    try {
      await saveConfig('PROXY_PATH', path);
      showToast(`✅ Configuração salva: ${path}`, 'success');
      hasChanges.value = false;
      window.dispatchEvent(new CustomEvent('config-updated'));
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      showToast('❌ Erro ao salvar configuração. Verifique o console.', 'error');
    } finally {
      isSaving.value = false;
    }
  };
  
  const handleReset = async () => {
    if (!confirm('Tem certeza que deseja resetar todas as configurações para o padrão?')) {
      return;
    }
    try {
      await resetConfig();
      const config = await loadAllConfigs();
      proxyPath.value = config.proxy_path || '/';
      appTheme.value = 'system';
      hasChanges.value = false;
      serverStatus.value = 'unknown';
      showToast('✅ Auto-Discovery resetado', 'success');
      window.dispatchEvent(new CustomEvent('config-updated'));
    } catch (error) {
      showToast('❌ Erro ao resetar', 'error');
    }
  };
  
  const handleCancelar = () => {
    loadAllConfigs().then(config => {
      proxyPath.value = config.proxy_path || '';
      hasChanges.value = false;
      serverStatus.value = 'unknown';
      showToast('Alterações descartadas', 'info');
    });
  };
  
  return (
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 16px; overflow-y: auto;">
      <div class="container" style="background: var(--md-sys-color-surface); max-width: 600px; width: 100%;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 1rem; color: var(--md-sys-color-primary); font-weight: 600; display: flex; align-items: center; gap: 6px;">
              <md-icon>settings</md-icon> Configurações
            </span>
            <span style="font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant); margin-left: 30px;">
              Ajustes Visuais e de Rede
            </span>
          </div>
          <md-icon-button onClick={() => navigate('')} title="Fechar Configurações">
            <md-icon>close</md-icon>
          </md-icon-button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
          
          {/* 🔥 SEÇÃO DE APARÊNCIA */}
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="font-size: 0.85rem; font-weight: 600; color: var(--md-sys-color-on-surface);">
              Aparência do Aplicativo
            </label>
            <md-outlined-select value={appTheme.value} onChange={handleThemeChange} style="width: 100%;">
              <md-select-option value="system"><div slot="headline">Sincronizar com o Sistema</div></md-select-option>
              <md-select-option value="light"><div slot="headline">Tema Claro</div></md-select-option>
              <md-select-option value="dark"><div slot="headline">Tema Escuro</div></md-select-option>
            </md-outlined-select>
          </div>

          <md-divider></md-divider>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label for="proxy-path" style="font-size: 0.85rem; font-weight: 600; color: var(--md-sys-color-on-surface); display: flex; justify-content: space-between; align-items: center;">
              Servidor Proxy
              {serverStatus.value === 'ok' && <span style="color: var(--md-sys-color-primary); font-size: 0.75rem; font-weight: bold;">(Online)</span>}
              {serverStatus.value === 'error' && <span style="color: var(--md-sys-color-error); font-size: 0.75rem; font-weight: bold;">(Offline)</span>}
            </label>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <md-outlined-text-field
                id="proxy-path"
                value={proxyPath.value}
                onInput={handleProxyPathChange}
                placeholder="Ex: /, /api ou https://push.com"
                style="flex-grow: 1; min-width: 200px;"
                disabled={isSaving.value || isTesting.value}
              >
                <md-icon slot="leading-icon">dns</md-icon>
              </md-outlined-text-field>
              
              <md-filled-tonal-button onClick={handleTestarConexao} disabled={isTesting.value || isSaving.value} style="height: 56px; flex-shrink: 0;">
                 {isTesting.value ? '...' : 'Testar'}
              </md-filled-tonal-button>
            </div>
            <span style="font-size: 0.7rem; color: var(--md-sys-color-on-surface-variant); line-height: 1.2;">
              Se o PWA foi instalado via GitHub Pages, informe a URL absoluta de um Worker ativo do Loco.
            </span>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px; background: var(--md-sys-color-surface-variant); border-radius: 8px;">
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--md-sys-color-on-surface-variant);">
              🔍 Resolução Dinâmica (Preview):
            </span>
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.75rem;">
              <div style="display: flex; gap: 8px; align-items: flex-start;">
                <span style="color: var(--md-sys-color-on-surface-variant); min-width: 70px; flex-shrink: 0; font-weight: 600;">Push URL:</span>
                <code style="color: var(--md-sys-color-on-surface); word-break: break-all; line-height: 1.4;">
                  {previewUrls.value.push}
                </code>
              </div>
              <div style="display: flex; gap: 8px; align-items: flex-start;">
                <span style="color: var(--md-sys-color-on-surface-variant); min-width: 70px; flex-shrink: 0; font-weight: 600;">Ping Test:</span>
                <code style="color: var(--md-sys-color-on-surface); word-break: break-all; line-height: 1.4;">
                  {previewUrls.value.ping}
                </code>
              </div>
              <div style="display: flex; gap: 8px; align-items: flex-start;">
                <span style="color: var(--md-sys-color-on-surface-variant); min-width: 70px; flex-shrink: 0; font-weight: 600;">Public Key:</span>
                <code style="color: var(--md-sys-color-on-surface); word-break: break-all; line-height: 1.4;">
                  {previewUrls.value.publicKey}
                </code>
              </div>
            </div>
          </div>
          
          <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 8px;">
            <md-outlined-button 
              onClick={handleCancelar} 
              disabled={!hasChanges.value || isSaving.value || isTesting.value} 
              style="flex: 1; min-width: 120px;"
            >
              Cancelar
            </md-outlined-button>
            
            <md-outlined-button 
              onClick={handleReset} 
              disabled={isSaving.value || isTesting.value} 
              style="color: var(--md-sys-color-error); --md-sys-color-outline: var(--md-sys-color-error); flex: 1; min-width: 120px;"
            >
              Auto-Discovery
            </md-outlined-button>
            
            <md-filled-button 
              onClick={handleSalvar} 
              disabled={!hasChanges.value || isSaving.value || isTesting.value} 
              style="flex: 1; min-width: 120px;"
            >
              {isSaving.value ? (
                <md-circular-progress indeterminate style="width: 20px; height: 20px;"></md-circular-progress>
              ) : (
                <>
                  <md-icon slot="icon">save</md-icon>
                  Salvar
                </>
              )}
            </md-filled-button>
          </div>
          
        </div>
      </div>
    </div>
  );
}