// Arquivo: monorepo/ui/src/components/ChatSection.tsx
import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { contatoSelecionado, showToast } from '../stores/state.ts';
import { gerarId } from '@loco/utils/db';
import {
  mensagensAtivas,
  hasMoreMessages,
  isFetchingMensagens,
  inicializarChat,
  carregarMaisMensagens,
  atualizarOuAdicionarChatAtivo,
  limparMemoriaChat,
  excluirMensagem
} from '../stores/mensagensStore.ts';
import type { Chat } from '@loco/utils/interfaces';
import { EventBus } from '@loco/utils/eventbus';

export function ChatSection() {
  const inputText = useSignal<string>('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isScrolledUp = useSignal<boolean>(false);

  useEffect(() => {
    if (contatoSelecionado.value) {
      inicializarChat(contatoSelecionado.value).then(() => {
        rolarParaFim();
      });
    }

    // ✅ ARQUITETURA: Escuta o EventBus em vez do Service Worker diretamente
    const unsubscribe = EventBus.on('sw:notify:chat-updated', ({ chatId }) => {
      import('../stores/mensagensStore.ts').then(m => {
        m.processarAtualizacaoDeStatusDB(chatId).then(() => {
          if (!isScrolledUp.value) rolarParaFim();
        });
      });
    });

    // Cleanup: remove a assinatura do EventBus quando o componente desmontar
    return () => {
      unsubscribe();
      limparMemoriaChat();
    };
  }, [contatoSelecionado.value]);

  const rolarParaFim = (force = false) => {
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }, force ? 10 : 100);
  };

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    isScrolledUp.value = target.scrollHeight - target.scrollTop - target.clientHeight > 100;
    
    if (target.scrollTop < 50 && hasMoreMessages.value) {
      const oldHeight = target.scrollHeight;
      carregarMaisMensagens(contatoSelecionado.value).then(() => {
        requestAnimationFrame(() => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight - oldHeight;
          }
        });
      });
    }
  };

  const handleEnviar = async () => {
    const texto = inputText.value.trim();
    const hashAtivo = contatoSelecionado.value;
    if (!texto || !hashAtivo) return;

    inputText.value = '';
    const msgId = gerarId();
    const handshakeId = gerarId();
    const agora = Date.now();

    const novaMensagem: Chat = {
      id: msgId,
      contatoHash: hashAtivo,
      conteudo: texto,
      tipo: 'out',
      createdAt: agora,
      handshake: handshakeId
    };

    await atualizarOuAdicionarChatAtivo(novaMensagem);
    rolarParaFim(true);

    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.active) throw new Error("Service Worker inativo");
      
      reg.active.postMessage({
        type: 'CRIAR_HANDSHAKE_OUT',
        payload: {
          rotasModulo: 'mensagem',
          params: { function: 'enviarMensagem', contato: hashAtivo, conteudo: texto, msgId, handshakeId, createdAt: agora }
        }
      });
    } catch (err: any) {
      showToast(`❌ Erro de thread: ${err.message}`, "error");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  const handleExcluir = async (msgId: string) => {
    if (confirm("Deseja apagar esta mensagem permanentemente?")) {
      await excluirMensagem(msgId, contatoSelecionado.value);
    }
  };

  const renderStatus = (msg: Chat) => {
    if (msg.tipo === 'in') return null;
    if (msg.errorAt) {
      return <md-icon title="Falha no envio" style="font-size: 14px; color: var(--md-sys-color-error);">error</md-icon>;
    }
    if (msg.readAt) {
      return <md-icon title="Lida" style="font-size: 14px; color: var(--md-sys-color-primary);">done_all</md-icon>;
    }
    if (msg.receivedAt) {
      return <md-icon title="Entregue ao dispositivo" style="font-size: 14px; opacity: 0.8;">done_all</md-icon>;
    }
    if (msg.sentAt) {
      return <md-icon title="Enviada ao servidor" style="font-size: 14px; opacity: 0.8;">check</md-icon>;
    }
    return <md-icon title="Aguardando rede..." style="font-size: 14px; opacity: 0.5;">schedule</md-icon>;
  };

  return (
    <div style="display: flex; flex-direction: column; height: 100%; flex-grow: 1; overflow: hidden;">
      <div
        ref={chatScrollRef}
        onScroll={handleScroll}
        style="flex-grow: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; background: var(--md-sys-color-surface-container-lowest);"
      >
        {isFetchingMensagens.value && (
          <div style="text-align: center; padding: 10px;">
            <md-circular-progress indeterminate style="width: 24px; height: 24px;"></md-circular-progress>
          </div>
        )}
        
        {!isFetchingMensagens.value && mensagensAtivas.value.length === 0 ? (
          <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; color: #888; font-size: 0.9rem;">
            Nenhuma mensagem. Diga um "Olá" (criptografado)! 🔒
          </div>
        ) : (
          mensagensAtivas.value.map(msg => {
            const isMine = msg.tipo === 'out';
            return (
              <div
                key={msg.id}
                style={`display: flex; flex-direction: column; max-width: 85%; align-self: ${isMine ? 'flex-end' : 'flex-start'};`}
              >
                <div style={`
                  padding: 10px 14px;
                  border-radius: 16px;
                  background: ${isMine ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-variant)'};
                  color: ${isMine ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)'};
                  border-bottom-right-radius: ${isMine ? '4px' : '16px'};
                  border-bottom-left-radius: ${!isMine ? '4px' : '16px'};
                  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                  white-space: pre-wrap;
                  word-wrap: break-word;
                `}>
                  {msg.conteudo}
                </div>
                
                <div style={`display: flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 0.7rem; color: #888; align-self: ${isMine ? 'flex-end' : 'flex-start'};`}>
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {renderStatus(msg)}
                  <md-icon-button
                    onClick={() => handleExcluir(msg.id)}
                    style="width: 20px; height: 20px; margin-left: 2px;"
                    title="Apagar mensagem"
                  >
                    <md-icon style="font-size: 14px; color: var(--md-sys-color-on-surface-variant);">delete</md-icon>
                  </md-icon-button>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      <div style="flex-shrink: 0; padding: 12px 16px; background: var(--md-sys-color-surface); border-top: 1px solid var(--md-sys-color-outline-variant); display: flex; gap: 8px; align-items: flex-end;">
        <md-outlined-text-field
          style="flex-grow: 1; margin-bottom: 0;"
          placeholder="Escreva uma mensagem..."
          value={inputText.value}
          onInput={(e: Event) => inputText.value = (e.target as HTMLInputElement).value}
          onKeyDown={handleKeyDown}
        ></md-outlined-text-field>
        <md-filled-icon-button
          onClick={handleEnviar}
          disabled={!inputText.value.trim()}
          style="height: 56px; width: 56px; border-radius: 16px;"
        >
          <md-icon>send</md-icon>
        </md-filled-icon-button>
      </div>
    </div>
  );
}