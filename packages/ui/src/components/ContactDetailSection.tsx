// src/components/ContactDetailSection.tsx
import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import qrcode from 'qrcode-generator';

import { contatosComHash, adicionarContato, removerContatoCompletamente } from '../stores/contatosStore.ts';
import { limparTodoHistorico } from '../stores/mensagensStore.ts';
import { profile } from '../stores/profileStore.ts';
import { contatoCompartilharHash, contatoSelecionado, showToast } from '../stores/state.ts';
import { gerarPayloadQrCodeCompacto, gerarLinkConviteWeb } from '@loco/utils/db';
import { navigate } from '../stores/router.ts';
import { ehContatoProprio } from '@loco/utils/db';

export function ContactDetailSection() {
  const qrCodeDataUrl = useSignal<string | null>(null);
  const isEditing = useSignal<boolean>(false);
  const editNome = useSignal<string>('');
  const editEmail = useSignal<string>('');
  const editProxyserver = useSignal<string>('');
  const isContatoProprio = useSignal<boolean>(false);

  const hash = contatoCompartilharHash.value;
  const item = contatosComHash.value.find(c => c.hash === hash);
  const contato = item?.contato;

  useEffect(() => {
    if (!contato) {
      qrCodeDataUrl.value = null;
      isEditing.value = false;
      isContatoProprio.value = false;
      return;
    }

    editNome.value = contato.name || '';
    editEmail.value = contato.email || '';
    editProxyserver.value = contato.subscription?.proxyserver || '';

    if (hash) {
      ehContatoProprio(hash, profile.value).then((ehProprio) => {
        isContatoProprio.value = ehProprio;
        if (ehProprio) {
          navigate('#profile');
        }
      });
    }

    (async () => {
      try {
        const payloadBinario = await gerarPayloadQrCodeCompacto(contato);
        const qr = qrcode(0, 'L');
        qr.addData(payloadBinario);
        qr.make();
        qrCodeDataUrl.value = qr.createDataURL(5, 0);
      } catch (e) {
        console.error("Erro ao gerar QR Code do contato:", e);
        qrCodeDataUrl.value = null;
      }
    })();
  }, [contato, hash]);

  if (!contato || !hash) return null;
  if (isContatoProprio.value) return null;

  const nomeExibicao = contato.name?.trim() || "Anônimo";

  const handleCopiarLink = async () => {
    const p = profile.value;
    if (!p) return showToast("Configure seu perfil primeiro para indicar contatos.", "error");

    try {
      const shareUrl = await gerarLinkConviteWeb(contato, p.vapidPrivateKeyJwk, p.vapidPublicKey);
      await navigator.clipboard.writeText(shareUrl);
      showToast(`✅ Link de indicação de ${nomeExibicao} copiado!`, "success");
    } catch (err: any) {
      showToast(`❌ Falha ao gerar link: ${err.message}`, "error");
    }
  };

  const handleEnviarMeusDados = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.active) throw new Error("Service Worker inativo.");
      
      reg.active.postMessage({
        type: 'CRIAR_HANDSHAKE_OUT',
        payload: {
          rotasModulo: 'contato',
          params: {
            function: 'enviarSubscription',
            contato: hash,
            responder: false
          }
        }
      });
      
      showToast("🚀 Meus dados foram enviados para o contato!", "success");
    } catch (err: any) {
      showToast(`❌ Erro ao enviar dados: ${err.message}`, "error");
    }
  };

  const handleSolicitarAtualizacao = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.active) throw new Error("Service Worker inativo.");
      
      reg.active.postMessage({
        type: 'CRIAR_HANDSHAKE_OUT',
        payload: {
          rotasModulo: 'contato',
          params: {
            function: 'confirmarSubscription',
            contato: hash,
            campos: ['trusted', 'subscription', 'vapidPublicKey', 'vapidPrivateKeyEnvelope', 'e2ePublicKey']
          }
        }
      });
      
      showToast("🔄 Solicitação de diagnóstico enviada!", "info");
    } catch (err: any) {
      showToast(`❌ Erro ao solicitar verificação: ${err.message}`, "error");
    }
  };

  const handleSalvarEdicao = async () => {
    try {
      const contatoAtualizado = {
        ...contato,
        name: editNome.value.trim(),
        email: editEmail.value.trim(),
        subscription: {
          ...contato.subscription,
          proxyserver: editProxyserver.value.trim()
        },
        updatedAt: Date.now(),
      };

      await adicionarContato(contatoAtualizado);
      isEditing.value = false;
      showToast("✅ Dados do contato atualizados!", "success");
    } catch (err: any) {
      showToast(`❌ Erro ao salvar contato: ${err.message}`, "error");
    }
  };

  const handleCancelarEdicao = () => {
    editNome.value = contato.name || '';
    editEmail.value = contato.email || '';
    editProxyserver.value = contato.subscription?.proxyserver || '';
    isEditing.value = false;
  };

  const handleIniciarChat = () => {
    navigate(`#chat=${hash}`);
  };

  const handleExcluirHistorico = async () => {
    const mensagemAlerta = `🛑 Tem certeza?\n\nTodas as mensagens enviadas e recebidas com ${nomeExibicao} serão apagadas permanentemente. Isso não pode ser desfeito.`;
    if (confirm(mensagemAlerta)) {
      try {
        await limparTodoHistorico(hash);
        showToast("🗑️ Histórico de mensagens apagado.", "success");
      } catch (e: any) {
        showToast(`❌ Erro ao apagar histórico: ${e.message}`, "error");
      }
    }
  };

  const handleExcluirContato = async () => {
    const mensagemAlerta = `🛑 ATENÇÃO!\n\nVocê está prestes a excluir o perfil de ${nomeExibicao} permanentemente.\n\nDeseja continuar?`;
    
    if (confirm(mensagemAlerta)) {
      try {
        await removerContatoCompletamente(hash);
        showToast("🗑️ Contato excluído com sucesso.", "success");
        if (contatoSelecionado.value === hash) {
          contatoSelecionado.value = '';
        }
        navigate('');
      } catch (e: any) {
        showToast(`❌ Erro ao excluir: ${e.message}`, "error");
      }
    }
  };

  const handleFechar = () => {
    navigate('');
  };

  return (
    <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 24px; overflow-y: auto;">
      
      <div class="container" style="background: var(--md-sys-color-surface); max-width: 480px; width: 100%; margin-bottom: 0; text-align: center;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span style="font-size: 0.9rem; color: var(--md-sys-color-primary); font-weight: 600; display: flex; align-items: center; gap: 6px;">
            <md-icon>badge</md-icon> Cartão de Contato
          </span>
          <div style="display: flex; gap: 4px;">
            {!isEditing.value && (
              <md-icon-button onClick={() => isEditing.value = true} title="Editar contato">
                <md-icon>edit</md-icon>
              </md-icon-button>
            )}
            <md-icon-button onClick={handleFechar} title="Fechar">
              <md-icon>close</md-icon>
            </md-icon-button>
          </div>
        </div>

        <md-icon style="font-size: 64px; color: var(--md-sys-color-primary); margin-bottom: 24px;">account_circle</md-icon>

        {isEditing.value ? (
          <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; text-align: left;">
            <md-outlined-text-field
              label="Nome do Contato"
              value={editNome.value}
              onInput={(e: Event) => editNome.value = (e.target as HTMLInputElement).value}
            ></md-outlined-text-field>

            <md-outlined-text-field
              label="E-mail do Contato"
              value={editEmail.value}
              onInput={(e: Event) => editEmail.value = (e.target as HTMLInputElement).value}
            ></md-outlined-text-field>

            <md-outlined-text-field
              label="Proxy Server (URL completa)"
              value={editProxyserver.value}
              onInput={(e: Event) => editProxyserver.value = (e.target as HTMLInputElement).value}
            ></md-outlined-text-field>

            <div style="display: flex; gap: 8px; margin-top: 4px;">
              <md-filled-button onClick={handleSalvarEdicao} style="flex: 1;">
                💾 Salvar
              </md-filled-button>
              <md-outlined-button onClick={handleCancelarEdicao} style="flex: 1;">
                Cancelar
              </md-outlined-button>
            </div>
          </div>
        ) : (
          <>
            <h2 style="justify-content: center; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              {nomeExibicao}
            </h2>

            {contato.trusted && (
              <div style="display: flex; justify-content: center; align-items: center; gap: 6px; color: var(--md-sys-color-primary); font-weight: 600; font-size: 0.9rem; margin-bottom: 6px;">
                <md-icon style="font-size: 1.2rem;">verified</md-icon> Contato Confiável
              </div>
            )}

            <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.9rem; margin-bottom: 4px;">{contato.email || 'Sem e-mail'}</p>
            <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.8rem; margin-bottom: 20px; word-break: break-all;">
              <md-icon style="font-size: 1rem; vertical-align: middle;">dns</md-icon> Proxy: {contato.subscription?.proxyserver || 'Não informado'}
            </p>
          </>
        )}

        {!isEditing.value && (
          <>
            <div style="background: var(--md-sys-color-surface-variant); padding: 16px; border-radius: 12px; margin-bottom: 20px; text-align: left; display: flex; flex-direction: column; gap: 16px;">
              <div>
                <div style="font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px; color: var(--md-sys-color-on-surface-variant);">
                  COMO VOCÊ VÊ ESTE CONTATO:
                </div>
                <div style="font-size: 0.9rem; display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                  {contato.trusted ? (
                    <><md-icon style="color: var(--md-sys-color-primary); font-size: 1.2rem;">verified</md-icon> Identidade verificada (Confiável)</>
                  ) : (
                    <><md-icon style="color: var(--md-sys-color-on-surface-variant); font-size: 1.2rem;">help</md-icon> Contato desconhecido (Não verificado)</>
                  )}
                </div>
              </div>

              <div>
                <div style="font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px; color: var(--md-sys-color-on-surface-variant);">
                  COMO ESTE CONTATO VÊ VOCÊ:
                </div>
                <div style="font-size: 0.9rem; display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                  {contato.me === 'trusted' && <><md-icon style="color: #0b8043; font-size: 1.2rem;">verified_user</md-icon> Ele(a) marcou você como Confiável</>}
                  {contato.me === 'saved' && <><md-icon style="color: var(--md-sys-color-primary); font-size: 1.2rem;">how_to_reg</md-icon> Ele(a) possui seu contato salvo</>}
                  {contato.me === 'wrong' && <><md-icon style="color: var(--md-sys-color-error); font-size: 1.2rem;">warning</md-icon> Seus dados no celular dele(a) estão desatualizados</>}
                  {(!contato.me || contato.me === 'none') && <><md-icon style="color: var(--md-sys-color-on-surface-variant); font-size: 1.2rem;">person_off</md-icon> Ele(a) ainda não possui seu contato salvo</>}
                </div>
              </div>
            </div>

            {qrCodeDataUrl.value && (
              <div style="background: #ffffff; color: #111111; padding: 16px; border-radius: 12px; border: 1px solid #eeeeee; margin-bottom: 20px; display: inline-block;">
                <img src={qrCodeDataUrl.value} alt="QR Code do Contato" style="max-width: 220px; width: 100%; height: auto; display: block; margin: 0 auto;" />
                <span style="font-size: 0.75rem; color: #555555; display: block; margin-top: 8px;">
                  Aponte a câmera (pelo App Loco) para se conectar com {nomeExibicao.split(' ')[0]}
                </span>
              </div>
            )}

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <md-filled-button onClick={handleCopiarLink} style="width: 100%;">
                <md-icon slot="icon">share</md-icon>
                Copiar Link de Indicação
              </md-filled-button>

              <md-outlined-button onClick={handleEnviarMeusDados} style="width: 100%;">
                <md-icon slot="icon">send_to_mobile</md-icon>
                Enviar meus dados ao contato
              </md-outlined-button>

              <md-outlined-button onClick={handleSolicitarAtualizacao} style="width: 100%;">
                <md-icon slot="icon">sync</md-icon>
                Verificar Status de Confiança
              </md-outlined-button>

              <md-outlined-button onClick={handleIniciarChat} style="width: 100%;">
                <md-icon slot="icon">chat</md-icon>
                Iniciar Conversa
              </md-outlined-button>

              <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
                <md-outlined-button 
                  onClick={handleExcluirHistorico} 
                  style="width: 100%; color: var(--md-sys-color-error); --md-sys-color-outline: var(--md-sys-color-error);"
                >
                  <md-icon slot="icon">delete_sweep</md-icon>
                  Apagar Histórico de Mensagens
                </md-outlined-button>

                <md-outlined-button 
                  onClick={handleExcluirContato} 
                  style="width: 100%; color: var(--md-sys-color-error); --md-sys-color-outline: var(--md-sys-color-error);"
                >
                  <md-icon slot="icon">delete_forever</md-icon>
                  Excluir Contato
                </md-outlined-button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}