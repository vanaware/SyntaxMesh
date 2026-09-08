import { useEffect } from 'preact/hooks';
import { contatosComHash, isCarregandoContatos, removerContatoCompletamente, homologarContatoPorPublicKey } from '../stores/contatosStore.ts';
import { showToast } from '../stores/state.ts';
import { navigate } from '../stores/router.ts';

export function ContatosSection() {
  useEffect(() => {}, []);

  const abrirChat = (hash: string) => {
    navigate(`#chat=${hash}`);
  };

  const abrirDetalhesContato = (e: Event, hash: string) => {
    e.stopPropagation();
    navigate(`#detail=${hash}`);
  };

  return (
    <div style="display: flex; flex-direction: column; width: 100%;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 0 4px;">
        <h2 style="font-size: 1rem; margin: 0; color: var(--md-sys-color-on-surface); font-weight: 600;">
          📇 Meus Contatos
        </h2>
        <md-icon-button onClick={() => navigate('#share')} title="Adicionar / Escanear Contato">
          <md-icon>person_add</md-icon>
        </md-icon-button>
      </div>
      
      <div style="max-height: calc(100vh - 150px); overflow-y: auto; padding-right: 4px;">
        {/* 🔥 ARQUITETURA: Spinner condicionado ao novo signal 'isCarregandoContatos' */}
        {isCarregandoContatos.value && contatosComHash.value.length === 0 ? (
          <div style="display: flex; justify-content: center; padding: 24px;">
            <md-circular-progress indeterminate></md-circular-progress>
          </div>
        ) : contatosComHash.value.length === 0 ? (
          <p style="padding: 16px 8px; color: var(--md-sys-color-on-surface-variant); text-align: center; margin: 0; font-size: 0.85rem;">
            Nenhum contato adicionado.
          </p>
        ) : (
          <md-list style="background: transparent;">
            {contatosComHash.value.map(({ contato, hash }) => {
              const nomeExibicao = contato.name?.trim() || "Anônimo";
              return (
                <md-list-item 
                  key={hash} 
                  onClick={() => abrirChat(hash)}
                  style="cursor: pointer; background: var(--md-sys-color-surface-variant); border-radius: 8px; margin-bottom: 6px;"
                >
                  <md-icon slot="start" style="color: var(--md-sys-color-on-surface-variant);">person</md-icon>
                  
                  <div slot="headline" style="display: flex; align-items: center; gap: 6px;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; display: block; font-size: 0.95rem; color: var(--md-sys-color-on-surface);">
                      <strong>{nomeExibicao}</strong>
                    </span>
                    {contato.trusted && (
                      <md-icon title="Contato Confiável" style="color: var(--md-sys-color-primary); font-size: 1.1rem;">verified</md-icon>
                    )}
                  </div>
                  
                  <span slot="supporting-text" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; font-size: 0.8rem; color: var(--md-sys-color-on-surface-variant);">
                    {contato.email || 'Sem e-mail'}
                  </span>
                  
                  <div slot="end" style="display: flex; gap: 0px; align-items: center; flex-shrink: 0;">
                    <md-icon-button onClick={(e) => abrirDetalhesContato(e, hash)}>
                      <md-icon style="font-size: 1.2rem;">qr_code_2</md-icon>
                    </md-icon-button>

                    {!contato.trusted && (
                      <md-icon-button onClick={async (e) => {
                        e.stopPropagation();
                        await homologarContatoPorPublicKey(contato.vapidPublicKey);
                        showToast("Contato marcado como confiável!", "success");
                      }}>
                        <md-icon style="font-size: 1.2rem;">verified</md-icon>
                      </md-icon-button>
                    )}

                    <md-icon-button onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Remover ${nomeExibicao} e apagar todo o histórico de conversas permanentemente?`)) {
                        await removerContatoCompletamente(hash);
                      }
                    }}>
                      <md-icon style="font-size: 1.2rem; color: var(--md-sys-color-error);">delete</md-icon>
                    </md-icon-button>
                  </div>
                </md-list-item>
              );
            })}
          </md-list>
        )}
      </div>
    </div>
  );
}