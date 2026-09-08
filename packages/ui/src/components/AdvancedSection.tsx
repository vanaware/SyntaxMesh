// Arquivo: monorepo/ui/src/components/AdvancedSection.tsx
import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { profile } from '../stores/profileStore.ts';
import { showToast } from '../stores/state.ts';
import { solicitarArmazenamentoPersistente, repararSubscricaoPush } from '../utils/mod.ts';
import { DebugPanel } from './DebugPanel.tsx';
import { APP_VERSION } from '@loco/utils/config';
import { navigate } from '../stores/router.ts';
import { loadAllConfigs } from '../stores/config-store.ts';
import { EventBus } from '@loco/utils/eventbus';

export function AdvancedSection() {
  const diagnostic = useSignal({
    identificacao: false, criptografia: false, blindagemServidor: false,
    permissoesNotificacao: false, inscricaoRegistrada: false, inscricaoValida: false,
    swAtivoEControlando: false, isOnline: navigator.onLine, isPwaInstalado: false,
    permissaoCamera: 'prompt', permissaoMicrofone: 'prompt', suporteBarcodeDetector: false,
    suporteOpfs: false, suporteWebRTC: false, suporteBackgroundSync: false,
    armazenamentoPersistido: false, cotaEspaco: { usoMB: 0, livreMB: 0 },
    proxyPath: '',
    loading: true,
  });
  
  const isReparing = useSignal(false);

  useEffect(() => {
    const updateConfig = async () => {
      const config = await loadAllConfigs();
      diagnostic.value = { ...diagnostic.value, proxyPath: config.proxy_path || '' };
    };
    
    // ✅ ARQUITETURA: Escuta o EventBus para atualizações de config
    const unsubscribeConfig = EventBus.on('loco:ui:config-updated', updateConfig);
    updateConfig();
    
    return () => {
      unsubscribeConfig();
    };
  }, []);

  const runDiagnostics = async () => {
    const p = profile.value;
    let envelopeOK = false;
    if (p?.vapidPrivateKeyEnvelope) {
      try {
        const envelopeJson = atob(p.vapidPrivateKeyEnvelope);
        const envelopeDecoded = JSON.parse(envelopeJson);
        if (envelopeDecoded.iv && envelopeDecoded.dadosCifrados && envelopeDecoded.chaveAesCifrada) {
          envelopeOK = true;
        }
      } catch { envelopeOK = false; }
    }

    let cameraState = 'prompt', micState = 'prompt';
    if ('navigator' in window && 'permissions' in navigator && (navigator as any).permissions.query) {
      try { cameraState = (await (navigator as any).permissions.query({ name: 'camera' as any })).state; } catch {}
      try { micState = (await (navigator as any).permissions.query({ name: 'microphone' as any })).state; } catch {}
    }

    let storagePersisted = false;
    let quotaInfo = { usoMB: 0, livreMB: 0 };
    if ('storage' in navigator) {
      if (navigator.storage.persisted) {
        try { storagePersisted = await navigator.storage.persisted(); } catch {}
      }
      if (navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          quotaInfo = {
            usoMB: +((estimate.usage || 0) / (1024 * 1024)).toFixed(1),
            livreMB: +(((estimate.quota || 0) - (estimate.usage || 0)) / (1024 * 1024)).toFixed(0)
          };
        } catch {}
      }
    }

    let swControlando = false, hasBackgroundSync = false;
    if ('serviceWorker' in navigator) {
      swControlando = navigator.serviceWorker.controller !== null;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) hasBackgroundSync = 'sync' in reg;
      } catch {}
    }

    const diag = {
      identificacao: !!(p?.vapidPublicKey && p?.vapidPrivateKeyJwk),
      criptografia: !!(p?.e2ePublicKey && p?.e2ePrivateKeyJwk),
      blindagemServidor: envelopeOK,
      permissoesNotificacao: 'Notification' in window && Notification.permission === 'granted',
      inscricaoRegistrada: !!(p?.subscription && p.subscription.endpoint),
      inscricaoValida: false,
      swAtivoEControlando: swControlando,
      isOnline: navigator.onLine,
      isPwaInstalado: window.matchMedia('(display-mode: standalone)').matches,
      permissaoCamera: cameraState,
      permissaoMicrofone: micState,
      suporteBarcodeDetector: 'BarcodeDetector' in window,
      suporteOpfs: 'storage' in navigator && 'getDirectory' in navigator.storage,
      suporteWebRTC: 'RTCPeerConnection' in window,
      suporteBackgroundSync: hasBackgroundSync,
      armazenamentoPersistido: storagePersisted,
      cotaEspaco: quotaInfo,
      proxyPath: diagnostic.value.proxyPath,
      loading: false,
    };

    if (diag.permissoesNotificacao && p?.subscription?.endpoint) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.pushManager) {
          const sub = await reg.pushManager.getSubscription();
          if (sub && sub.endpoint === p.subscription.endpoint) diag.inscricaoValida = true;
        }
      } catch {}
    }
    
    diagnostic.value = diag;
  };

  useEffect(() => {
    runDiagnostics();
    
    // ✅ ARQUITETURA: Escuta o EventBus em vez de window.addEventListener
    const unsubOnline = EventBus.on('loco:network:online', () => {
      diagnostic.value = { ...diagnostic.value, isOnline: true };
    });
    const unsubOffline = EventBus.on('loco:network:offline', () => {
      diagnostic.value = { ...diagnostic.value, isOnline: false };
    });

    return () => {
      unsubOnline();
      unsubOffline();
    };
  }, [profile.value]);

  const diag = diagnostic.value;

  const handleSolicitarPersistenciaManual = async () => {
    const ok = await solicitarArmazenamentoPersistente();
    if (ok) showToast("✅ Armazenamento Persistente protegido com sucesso!", "success");
    else showToast("ℹ️ O navegador manteve o armazenamento padrão. Tente adicionar o app à Tela Inicial.", "info");
    await runDiagnostics();
  };

  const handleForceSync = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg.active) {
          reg.active.postMessage({ type: 'PROCESSAR_FILA_HANDSHAKE' });
          showToast("🔄 Comando de sincronização enviado ao Service Worker!", "info");
        } else {
          showToast("⚠️ Service Worker inativo.", "error");
        }
      } else {
        showToast("⚠️ Service Worker não suportado.", "error");
      }
    } catch (e: any) {
      showToast(`❌ Erro ao sincronizar: ${e.message}`, "error");
    }
  };

  const handleRepararPush = async () => {
    isReparing.value = true;
    try {
      showToast("Tentando reparar infraestrutura de Push...", "info");
      const sucesso = await repararSubscricaoPush();
      if (sucesso) {
        showToast("✅ Conexão restaurada com sucesso!", "success");
        await runDiagnostics();
      } else {
        showToast("❌ Não foi possível reparar a conexão. Verifique as permissões de notificação no cadeado do navegador.", "error");
      }
    } catch (e: any) {
      showToast(`❌ Erro: ${e.message}`, "error");
    } finally {
      isReparing.value = false;
    }
  };

  const handleFechar = () => {
    navigate('');
  };

  return (
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 24px; overflow-y: auto;">
      <div class="container" style="background: var(--md-sys-color-surface); max-width: 600px; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 1rem; color: var(--md-sys-color-primary); font-weight: 600; display: flex; align-items: center; gap: 6px;">
              <md-icon>health_and_safety</md-icon> Diagnóstico do Sistema
            </span>
            <span style="font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant); margin-left: 30px;">
              Build Version: v{APP_VERSION}
            </span>
          </div>
          <md-icon-button onClick={handleFechar} title="Fechar Avançado">
            <md-icon>close</md-icon>
          </md-icon-button>
        </div>

        {diag.loading ? (
          <p style="font-size: 0.85rem; color: var(--md-sys-color-on-surface-variant); margin: 0;">Analisando requisitos...</p>
        ) : (
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <h4 style="font-size: 0.8rem; margin: 0 0 8px 0; color: var(--md-sys-color-primary); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                🛑 Requisitos Obrigatórios
              </h4>
              <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.85rem; color: var(--md-sys-color-on-surface); line-height: 1.8;">
                <li>{diag.identificacao ? '✅' : '❌'} Identidade (Chaves VAPID)</li>
                <li>{diag.criptografia ? '✅' : '❌'} Criptografia Ponto a Ponta (E2E)</li>
                <li>{diag.blindagemServidor ? '✅' : '❌'} Blindagem do Servidor (Envelope)</li>
                <li>{diag.permissoesNotificacao ? '✅' : '❌'} Permissão de Notificações</li>
                <li>{diag.inscricaoRegistrada ? '✅' : '❌'} Inscrição Push registrada</li>
                <li>{diag.inscricaoValida ? '✅' : '❌'} Inscrição Push válida/ativa</li>
                <li>{diag.swAtivoEControlando ? '✅' : '❌'} Service Worker em controle ativo</li>
              </ul>
              
              {(!diag.inscricaoValida || !diag.inscricaoRegistrada || !diag.permissoesNotificacao) && (
                <div style="margin-top: 12px; padding: 12px; background: var(--md-sys-color-error-container); border-radius: 8px;">
                  <span style="display: block; color: var(--md-sys-color-on-error-container); font-size: 0.8rem; font-weight: 500; margin-bottom: 8px;">
                    Falha detectada na infraestrutura de rede (Web Push). Você não conseguirá receber mensagens.
                  </span>
                  <md-filled-button onClick={handleRepararPush} disabled={isReparing.value} style="width: 100%; --md-sys-color-primary: var(--md-sys-color-error); --md-sys-color-on-primary: var(--md-sys-color-on-error);">
                    <md-icon slot="icon">build</md-icon>
                    {isReparing.value ? "Reparando..." : "Tentar Reparar Conexão Push"}
                  </md-filled-button>
                </div>
              )}
            </div>

            <md-divider></md-divider>

            <div>
              <h4 style="font-size: 0.8rem; margin: 0 0 8px 0; color: var(--md-sys-color-secondary); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                ⚡ Recursos Desejáveis & Status
              </h4>
              <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.85rem; color: var(--md-sys-color-on-surface); line-height: 1.8;">
                <li>{diag.isOnline ? '✅ Conexão com a Internet' : '⚠️ Dispositivo Offline (Mensagens enfileiradas)'}</li>
                <li>{diag.isPwaInstalado ? '✅ App Instalado (PWA Standalone)' : 'ℹ️ Executando na Aba do Navegador'}</li>
                <li>{diag.suporteOpfs ? '✅ Disco Virtual OPFS Suportado' : '⚠️ Sem suporte a OPFS'}</li>
                <li>{diag.suporteWebRTC ? '✅ P2P WebRTC Disponível' : '⚠️ Sem Suporte a WebRTC P2P'}</li>
                <li>{diag.suporteBackgroundSync ? '✅ Background Sync Ativo' : 'ℹ️ Sem Background Sync nativo'}</li>
                <li>
                  {diag.permissaoCamera === 'granted' ? '✅ Permissão de Câmera Concedida' :
                   diag.permissaoCamera === 'denied' ? '⚠️ Permissão de Câmera Negada' :
                   'ℹ️ Permissão de Câmera (Pendente)'}
                </li>
                <li>{diag.suporteBarcodeDetector ? '✅ Leitor Nativo de QR Code' : '⚠️ Leitor QR Nativo Indisponível'}</li>
                <li style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
                  <span>{diag.armazenamentoPersistido ? '✅ Armazenamento Persistente Protegido' : 'ℹ️ Armazenamento Padrão'}</span>
                  {!diag.armazenamentoPersistido && (
                    <md-outlined-button onClick={handleSolicitarPersistenciaManual} style="height: 32px; font-size: 0.75rem; margin-bottom: 0;">
                      Proteger Dados
                    </md-outlined-button>
                  )}
                </li>
                <li style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
                  <span>🔗 <strong>Proxy Path:</strong> {diag.proxyPath || '(Raiz Relativa)'}</span>
                  <md-outlined-button onClick={() => navigate('#settings')} style="height: 32px; font-size: 0.75rem; margin-bottom: 0;">
                    <md-icon slot="icon">edit</md-icon>
                    Configurar
                  </md-outlined-button>
                </li>
                <li style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--md-sys-color-outline-variant);">
                  <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: bold; color: var(--md-sys-color-primary);">Fila de Handshakes</span>
                    <span style="font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant);">Força o reenvio de pacotes pendentes (Retries).</span>
                  </div>
                  <md-outlined-button onClick={handleForceSync} style="height: 32px; font-size: 0.75rem; margin-bottom: 0;" disabled={!diag.isOnline}>
                    <md-icon slot="icon">sync</md-icon>
                    Forçar Sync
                  </md-outlined-button>
                </li>
                {diag.cotaEspaco.livreMB > 0 && (
                  <li style="color: var(--md-sys-color-on-surface-variant); font-size: 0.8rem; margin-top: 12px; text-align: center;">
                    📊 Uso: <strong>{diag.cotaEspaco.usoMB} MB</strong> de ~{(diag.cotaEspaco.livreMB / 1024).toFixed(1)} GB livres
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
      
      <div style="max-width: 600px; width: 100%;">
        <DebugPanel />
      </div>
    </div>
  );
}