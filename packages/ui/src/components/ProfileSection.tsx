// src/components/ProfileSection.tsx
import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import qrcode from 'qrcode-generator';

import { profile, carregarProfile, atualizarProfile } from '../stores/profileStore.ts';
import { profileName, profileEmail, addDebugLog, showToast, sharePayload } from '../stores/state.ts';
import { gerarProfileCompleto, getServerPublicKey } from '../utils/mod.ts';
import { cifrarChaveVapid } from '@loco/utils/proxy';
import { salvarProfile, serializarPublicKeyVapid } from '@loco/utils/db';
import { gerarPayloadQrCodeCompacto, gerarLinkConviteWeb, processarQualquerConvite } from '@loco/utils/db';
import { adicionarContato } from '../stores/contatosStore.ts';
import { navigate } from '../stores/router.ts';
import type { Contato } from '@loco/utils/interfaces';

export function ProfileSection() {
  const qrCodeDataUrl = useSignal<string | null>(null);
  const isEditing = useSignal<boolean>(false);
  
  const isProcessing = useSignal<boolean>(false);
  const inviterPreview = useSignal<Partial<Contato> | null>(null);
  const isLoadingInviter = useSignal<boolean>(false);

  useEffect(() => {
    carregarProfile();
  }, []);

  const p = profile.value;
  // Apenas garantimos a Identidade Criptográfica (A falta do Endpoint de Push não trava mais a tela)
  const isIdentityComplete = !!(p?.vapidPublicKey && p?.vapidPrivateKeyJwk && p?.name);

  useEffect(() => {
    if (!isIdentityComplete) {
      isEditing.value = true;
    } else {
      isEditing.value = false;
    }
  }, [isIdentityComplete]);

  useEffect(() => {
    if (!isIdentityComplete && sharePayload.value) {
      isLoadingInviter.value = true;
      processarQualquerConvite(sharePayload.value)
        .then(preview => {
          inviterPreview.value = preview;
        })
        .catch(err => {
          console.warn("Convite inválido no onboarding:", err);
        })
        .finally(() => {
          isLoadingInviter.value = false;
        });
    }
  }, [isIdentityComplete, sharePayload.value]);

  useEffect(() => {
    const renderQrCode = async () => {
      if (!p || !isIdentityComplete) return;
      try {
        const payloadBinario = await gerarPayloadQrCodeCompacto(p);
        const qr = qrcode(0, 'L');
        qr.addData(payloadBinario);
        qr.make();
        qrCodeDataUrl.value = qr.createDataURL(5, 0); 
      } catch (e) {
        console.error("Falha ao gerar QR Code:", e);
        qrCodeDataUrl.value = null;
      }
    };

    if (isIdentityComplete) {
      renderQrCode();
    } else {
      qrCodeDataUrl.value = null;
    }
  }, [p, isIdentityComplete]);

  const handleGerarOuCorrigir = async () => {
    const eraNovo = !isIdentityComplete;
    if (isProcessing.value) return; 

    try {
      isProcessing.value = true;
      const pNovo = await gerarProfileCompleto(profileName.value, profileEmail.value);
      await atualizarProfile(pNovo);
      
      // Processa a Inclusão de Contato do Convite, mesmo se o Push falhou silenciosamente
      if (eraNovo && inviterPreview.value && pNovo.vapidPublicKey) {
        try {
          const inviter = inviterPreview.value;
          const contatoId = await serializarPublicKeyVapid(inviter.vapidPublicKey!);
          
          const novoContato: Contato = {
            id: contatoId,
            vapidPublicKey: inviter.vapidPublicKey!,
            email: inviter.email || '',
            name: inviter.name || '', 
            e2ePublicKey: inviter.e2ePublicKey!,
            subscription: inviter.subscription!,
            vapidPrivateKeyEnvelope: inviter.vapidPrivateKeyEnvelope!,
            trusted: true, 
            me: 'none', 
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          
          await adicionarContato(novoContato);
          
          const reg = await navigator.serviceWorker.ready;
          if (reg.active) {
            reg.active.postMessage({
              type: 'CRIAR_HANDSHAKE_OUT',
              payload: { rotasModulo: 'contato', params: { function: 'enviarSubscription', contato: contatoId, responder: false } }
            });
          }

          sharePayload.value = null; 
          showToast(`✅ Identidade criada! Conectado com ${inviter.name}.`, "success");
          navigate(`#detail=${contatoId}`);
          return;
        } catch (errContato) {
          console.error("Falha ao salvar contato durante onboarding", errContato);
        }
      }

      isEditing.value = false;
      if (eraNovo && !inviterPreview.value) {
        showToast(`✅ Perfil inicializado com sucesso!`, "success");
        navigate(''); 
      } else if (!eraNovo) {
        showToast(`✅ Perfil atualizado!`, "success");
      }

    } catch (err: any) {
      addDebugLog(`❌ Erro no processo: ${err.message}`);
      showToast(`❌ Falha Crítica: ${err.message}`, "error");
    } finally {
      isProcessing.value = false;
    }
  };

  const handleCancelarEdicao = () => {
    if (p) {
      profileName.value = p.name || '';
      profileEmail.value = p.email || '';
    }
    isEditing.value = false;
  };

  const handleCompartilhar = async () => {
    try {
      if (!p) return showToast("Salve o perfil primeiro.", "error");
      const serverPublicKeyJwk = await getServerPublicKey();

      const novoEnvelope = await cifrarChaveVapid(p.vapidPrivateKeyJwk, serverPublicKeyJwk);
      p.vapidPrivateKeyEnvelope = novoEnvelope;
      p.updatedAt = Date.now();
      await salvarProfile(p);
      await atualizarProfile(p);

      const shareUrl = await gerarLinkConviteWeb(p, p.vapidPrivateKeyJwk, p.vapidPublicKey);
      await navigator.clipboard.writeText(shareUrl);
      
      showToast("✅ Link de convite copiado! Agora envie para seu contato.", "success");
    } catch (err: any) {
      addDebugLog(`❌ Erro: ${err.message}`);
      showToast(`❌ ${err.message}`, "error");
    }
  };

  return (
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 0 0 24px 0; overflow-y: auto;">
      
      <div class="container" style="background: var(--md-sys-color-surface); max-width: 480px; width: 100%; margin-bottom: 24px; text-align: center;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span style="font-size: 0.9rem; color: var(--md-sys-color-primary); font-weight: 600; display: flex; align-items: center; gap: 6px;">
            <md-icon>account_circle</md-icon> Identidade Local
          </span>
          <div style="display: flex; gap: 4px;">
            {isIdentityComplete && !isEditing.value && (
              <md-icon-button onClick={() => isEditing.value = true} title="Editar meu perfil">
                <md-icon>edit</md-icon>
              </md-icon-button>
            )}
          </div>
        </div>

        <md-icon style="font-size: 64px; color: var(--md-sys-color-primary); margin-bottom: 24px;">account_circle</md-icon>

        {isEditing.value ? (
          <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 10px; text-align: left;">
            
            {!isIdentityComplete && isLoadingInviter.value && (
              <div style="display: flex; justify-content: center; margin-bottom: 16px;">
                <md-circular-progress indeterminate style="width: 24px; height: 24px;"></md-circular-progress>
              </div>
            )}

            {!isIdentityComplete && inviterPreview.value && !isLoadingInviter.value && (
              <div style="background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); padding: 16px; border-radius: 12px; margin-bottom: 8px; text-align: center; border: 1px solid var(--md-sys-color-outline-variant);">
                <md-icon style="font-size: 32px; margin-bottom: 8px; color: var(--md-sys-color-primary);">waving_hand</md-icon>
                <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 4px;">
                  Convite de {inviterPreview.value.name?.trim() || 'Anônimo'}
                </div>
                <div style="font-size: 0.85rem; opacity: 0.9;">
                  Preencha seus dados abaixo para criar sua identidade descentralizada e iniciar a conversa com segurança.
                </div>
              </div>
            )}

            {!isIdentityComplete && !inviterPreview.value && !isLoadingInviter.value && (
               <p style="font-size: 0.85rem; color: var(--md-sys-color-on-surface-variant); margin-bottom: 8px; text-align: center;">
                 Este nome será visível para os contatos que você convidar.
               </p>
            )}

            <md-outlined-text-field
              label="Seu Nome"
              placeholder="Ex: João da Silva"
              value={profileName.value}
              onInput={(e: Event) => profileName.value = (e.target as HTMLInputElement).value}
              disabled={isProcessing.value}
            ></md-outlined-text-field>
            
            <md-outlined-text-field
              label="Seu E-mail (Opcional)"
              placeholder="Ex: joao@email.com"
              value={profileEmail.value}
              onInput={(e: Event) => profileEmail.value = (e.target as HTMLInputElement).value}
              disabled={isProcessing.value}
            ></md-outlined-text-field>

            <div style="display: flex; gap: 8px; margin-top: 8px;">
              <md-filled-button 
                onClick={handleGerarOuCorrigir} 
                style="flex: 1;"
                disabled={!profileName.value.trim() || isProcessing.value ? true : undefined}
              >
                {isProcessing.value ? "⏳ Processando..." : (!isIdentityComplete ? "🚀 Iniciar Perfil" : "💾 Salvar")}
              </md-filled-button>
              
              {isIdentityComplete && (
                <md-outlined-button 
                  onClick={handleCancelarEdicao} 
                  style="flex: 1;"
                  disabled={isProcessing.value ? true : undefined}
                >
                  Cancelar
                </md-outlined-button>
              )}
            </div>
          </div>
        ) : (
          <>
            <h2 style="justify-content: center; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              {p?.name?.trim() || "Anônimo"}
            </h2>
            <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.9rem; margin-bottom: 24px;">{p?.email || 'Sem e-mail'}</p>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <md-outlined-button onClick={handleCompartilhar} style="width: 100%;">
                <md-icon slot="icon">share</md-icon>
                Compartilhar Link de Convite
              </md-outlined-button>
            </div>
          </>
        )}
      </div>

      {qrCodeDataUrl.value && isIdentityComplete && !isEditing.value && (
        <div class="container" style="background: #ffffff; color: #111111; max-width: 480px; width: 100%; border-left-color: var(--md-sys-color-primary); text-align: center;">
          <h3 style="font-size: 1rem; color: #111111; margin-top: 0; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <md-icon style="font-size: 1.2rem; color: #111111;">qr_code_2</md-icon>
            Seu QR Code
          </h3>
          <p style="font-size: 0.8rem; color: #555555; margin-bottom: 16px;">
            Mostre isso para um amigo escanear pelo App Loco.
          </p>
          <img src={qrCodeDataUrl.value} alt="QR Code" style="max-width: 220px; width: 100%; height: auto; border-radius: 8px; border: 1px solid #eeeeee; margin: 0 auto;" />
        </div>
      )}

    </div>
  );
}