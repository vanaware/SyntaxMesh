// src/components/WebTorrentLabsSection.tsx
import { useSignal, useComputed } from "@preact/signals";
import { useRef } from "preact/hooks";
import { showToast } from "../stores/state.ts";
import { navigate, pastaSelecionada } from "../stores/router.ts";
import {
  pastasAtivas,
  progressoMap,
  criarNovaPastaOffline,
  adicionarMagnetDownload,
  isMotorLigar,
  atualizarPermissaoPasta,
  adicionarArquivosPasta,
  removerArquivoPasta,
  baixarArquivoOpfs,
  baixarZipPasta,
  alternarStatusPasta,
  excluirPasta,
} from "../stores/torrentLabsStore.ts";

export function WebTorrentLabsSection() {
  const inputMagnet = useSignal<string>("");
  const newFolderName = useSignal<string>("");
  const newFilePermission = useSignal<"public" | "listed" | "trusted">("trusted");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendInputRef = useRef<HTMLInputElement>(null);
  const confirmDeleteOpen = useSignal<boolean>(false);

  const p = useComputed(() =>
    pastasAtivas.value.find((x) => x.id === pastaSelecionada.value),
  );

  const handleCreateFolder = async () => {
    const files = fileInputRef.current?.files;
    if (files && files.length > 0) {
      if (!newFolderName.value.trim()) {
        showToast("Digite um nome para a Pasta primeiro.", "error");
        return;
      }
      await criarNovaPastaOffline(
        newFolderName.value.trim(),
        files,
        newFilePermission.value,
      );
      newFolderName.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
      showToast("Pasta P2P criada offline com sucesso!", "success");
    }
  };

  const handleAppendFiles = async () => {
    const files = appendInputRef.current?.files;
    if (files && files.length > 0 && p.value) {
      if (p.value.status !== "standby") {
        showToast("Coloque a pasta em Standby para editar.", "error");
        return;
      }
      await adicionarArquivosPasta(p.value.id, files);
      if (appendInputRef.current) appendInputRef.current.value = "";
    }
  };

  const handleCopiarMagnet = async (magnet?: string) => {
    if (magnet) {
      await navigator.clipboard.writeText(magnet);
      showToast("Magnet URI copiado!", "success");
    } else {
      showToast("Ative a pasta primeiro para gerar um Magnet URI.", "info");
    }
  };

  const handleExcluirPasta = async () => {
    if (!p.value) return;

    const success = await excluirPasta(p.value.id);
    if (success) {
      confirmDeleteOpen.value = false;
      navigate("#labs");
    }
  };

  const handleDebugConsole = () => {
    const pasta = p.value;
    const motor = isMotorLigar.value;
    const magnet = inputMagnet.value;

    console.group("🔍 Debug WebTorrent Labs");
    console.log("Motor P2P:", motor ? "✅ Ligado" : "❌ Desligado");
    console.log("Magnet URI:", magnet || "(vazio)");
    console.log("Pasta selecionada:", pasta || "(nenhuma)");
    console.log("Pastas ativas:", pastasAtivas.value.length);
    console.log("Mapa de progresso:", progressoMap.value);
    console.log("WebTorrent disponível:", typeof (window as any).WebTorrent !== "undefined");
    console.groupEnd();

    showToast("Logs enviados para o Console (F12)", "info");
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // ========================================================================
  // DIÁLOGO DE CONFIRMAÇÃO DE EXCLUSÃO
  // ========================================================================
  if (confirmDeleteOpen.value && p.value) {
    return (
      <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 24px;">
        <div
          style="max-width: 500px; width: 100%; background: var(--md-sys-color-surface-container-high); border-radius: 16px; padding: 24px;"
        >
          <h3
            style="margin: 0 0 16px 0; color: var(--md-sys-color-error); display: flex; align-items: center; gap: 8px;"
          >
            <md-icon>warning</md-icon>
            Confirmar Exclusão
          </h3>
          <p style="margin: 0 0 16px 0; color: var(--md-sys-color-on-surface-variant);">
            Tem certeza que deseja excluir a pasta <strong>"{p.value.name}"</strong>?
          </p>
          <div
            style="background: var(--md-sys-color-error-container); padding: 12px; border-radius: 8px; margin-bottom: 24px;"
          >
            <p
              style="margin: 0; font-size: 0.9rem; color: var(--md-sys-color-on-error-container);"
            >
              ⚠️ <strong>Atenção:</strong> Esta ação é irreversível. Todos os arquivos, o torrent
              ativo e os metadados serão permanentemente removidos.
            </p>
          </div>
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <md-outlined-button onClick={() => (confirmDeleteOpen.value = false)}>
              Cancelar
            </md-outlined-button>
            <md-filled-button
              onClick={handleExcluirPasta}
              style="--md-sys-color-primary: var(--md-sys-color-error);"
            >
              <md-icon slot="icon">delete_forever</md-icon>
              Excluir Permanentemente
            </md-filled-button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================================
  // ESTADO VAZIO — criação de pasta + download via magnet
  // ========================================================================
  const renderEmptyState = () => (
    <div
      style="max-width: 600px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 24px;"
    >
      {/* Nova Pasta */}
      <div class="container" style="margin-bottom: 0;">
        <h3
          style="font-size: 1.1rem; margin-top: 0; color: var(--md-sys-color-primary); display: flex; align-items: center; gap: 8px;"
        >
          <md-icon>create_new_folder</md-icon> Nova Pasta P2P
        </h3>
        <p
          style="font-size: 0.85rem; color: var(--md-sys-color-on-surface-variant); margin-bottom: 16px;"
        >
          Crie pastas locais. Você pode adicionar arquivos livremente offline e compartilhar depois!
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <md-outlined-text-field
            label="Nome da Pasta / Álbum"
            value={newFolderName.value}
            onInput={(e: Event) =>
              (newFolderName.value = (e.target as HTMLInputElement).value)
            }
          ></md-outlined-text-field>

          <div style="display: flex; gap: 8px;">
            <md-outlined-select
              value={newFilePermission.value}
              onChange={(e: Event) =>
                (newFilePermission.value = (e.target as any).value)
              }
              style="flex: 1;"
            >
              <md-select-option value="trusted">
                <div slot="headline">Contatos Confiáveis</div>
              </md-select-option>
              <md-select-option value="listed">
                <div slot="headline">Lista Restrita</div>
              </md-select-option>
              <md-select-option value="public">
                <div slot="headline">Público</div>
              </md-select-option>
            </md-outlined-select>

            <input
              type="file"
              id="multi-file-upload"
              multiple
              ref={fileInputRef}
              style="display: none;"
            />
            <label for="multi-file-upload" style="flex: 1; margin: 0;">
              <md-filled-tonal-button
                onClick={() => fileInputRef.current?.click()}
                style="width: 100%; height: 56px;"
              >
                Selecionar Arquivos...
              </md-filled-tonal-button>
            </label>
          </div>

          <md-filled-button
            onClick={handleCreateFolder}
            disabled={!newFolderName.value.trim()}
            style="width: 100%;"
          >
            Criar Pasta
          </md-filled-button>
        </div>
      </div>

      {/* Download via Magnet */}
      <div class="container" style="margin-bottom: 0;">
        <h3
          style="font-size: 1.1rem; margin-top: 0; color: var(--md-sys-color-on-surface); display: flex; align-items: center; gap: 8px;"
        >
          <md-icon>download</md-icon> Baixar Mídia Externa
          {!isMotorLigar.value && (
            <span
              style="font-size: 0.75rem; color: var(--md-sys-color-error); font-weight: 500; margin-left: 8px;"
            >
              ⚠️ Motor desligado
            </span>
          )}
        </h3>
        <p
          style="font-size: 0.85rem; color: var(--md-sys-color-on-surface-variant); margin-bottom: 16px;"
        >
          (Requer Motor Ligado). Cole um Magnet para importar a pasta via P2P.
        </p>
        <div style="display: flex; gap: 8px;">
          <md-outlined-text-field
            label="Magnet URI"
            value={inputMagnet.value}
            onInput={(e: Event) =>
              (inputMagnet.value = (e.target as HTMLInputElement).value)
            }
            style="flex: 1;"
          ></md-outlined-text-field>
          <md-filled-button
            onClick={() => {
              if (!inputMagnet.value.trim()) {
                showToast("Cole um Magnet URI primeiro.", "error");
                return;
              }
              adicionarMagnetDownload(inputMagnet.value);
              inputMagnet.value = "";
              navigate("#labs");
            }}
            disabled={!inputMagnet.value.trim() || !isMotorLigar.value}
            style="height: 56px;"
          >
            <md-icon slot="icon">download</md-icon>
            Baixar
          </md-filled-button>
        </div>
      </div>

      {/* Botão de Debug */}
      <div style="margin-top: 16px; text-align: center;">
        <md-text-button onClick={handleDebugConsole}>
          <md-icon slot="icon">bug_report</md-icon>
          Debug (Console)
        </md-text-button>
      </div>
    </div>
  );

  if (!p.value) {
    return (
      <div style="flex-grow: 1; overflow-y: auto; padding: 24px;">
        {renderEmptyState()}
      </div>
    );
  }

  // ========================================================================
  // DETALHE DA PASTA
  // ========================================================================
  const liveProg = progressoMap.value[p.value.id];
  const isStandby = p.value.status === "standby";

  return (
    <div
      style="flex-grow: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 24px;"
    >
      <div style="max-width: 800px; width: 100%; margin: 0 auto;">
        {/* CABEÇALHO DA PASTA */}
        <div
          style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--md-sys-color-outline-variant); flex-wrap: wrap; gap: 16px;"
        >
          <div>
            <h2
              style="margin: 0 0 8px 0; font-size: 1.5rem; color: var(--md-sys-color-on-surface); display: flex; align-items: center; gap: 8px;"
            >
              {p.value.name}
              <span
                style={`
                  font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; font-weight: bold; text-transform: uppercase;
                  background: ${
                    isStandby
                      ? "var(--md-sys-color-surface-variant)"
                      : p.value.status === "seeding"
                        ? "var(--md-sys-color-primary-container)"
                        : "#e1f5fe"
                  };
                  color: ${
                    isStandby
                      ? "var(--md-sys-color-on-surface-variant)"
                      : p.value.status === "seeding"
                        ? "var(--md-sys-color-on-primary-container)"
                        : "#01579b"
                  };
                `}
              >
                {p.value.status}
              </span>
            </h2>
            <div
              style="display: flex; gap: 12px; font-size: 0.85rem; color: var(--md-sys-color-on-surface-variant); align-items: center; flex-wrap: wrap;"
            >
              <span style="display: flex; align-items: center; gap: 4px;">
                <md-icon style="font-size: 1rem;">fingerprint</md-icon> ID:{" "}
                {p.value.id.substring(0, 8)}
              </span>
              <md-outlined-select
                value={p.value.permission}
                onChange={(e: Event) =>
                  atualizarPermissaoPasta(p.value!.id, (e.target as any).value)
                }
                style="height: 32px;"
              >
                <md-select-option value="trusted">
                  <div slot="headline">Confiáveis</div>
                </md-select-option>
                <md-select-option value="listed">
                  <div slot="headline">Restrita</div>
                </md-select-option>
                <md-select-option value="public">
                  <div slot="headline">Pública</div>
                </md-select-option>
              </md-outlined-select>
              <span style="display: flex; align-items: center; gap: 4px;">
                <md-icon style="font-size: 1rem;">date_range</md-icon>{" "}
                {new Date(p.value.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-direction: column; align-items: flex-end;">
            <div style="display: flex; gap: 8px;">
              <md-filled-tonal-button
                onClick={() => alternarStatusPasta(p.value!.id)}
                style={
                  !isStandby
                    ? "--md-sys-color-secondary-container: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container);"
                    : ""
                }
              >
                <md-icon slot="icon">
                  {isStandby ? "play_arrow" : "pause"}
                </md-icon>
                {isStandby ? "Ativar Pasta" : "Colocar em Standby"}
              </md-filled-tonal-button>
              <md-outlined-button
                onClick={() => handleCopiarMagnet(p.value?.magnetURI)}
                disabled={!p.value.magnetURI}
                title={
                  !p.value.magnetURI
                    ? "Ligue o motor P2P e ative a pasta para gerar o Magnet URI"
                    : "Copiar Magnet URI"
                }
              >
                <md-icon slot="icon">share</md-icon> Copiar Magnet
              </md-outlined-button>
            </div>
            {!isMotorLigar.value && !isStandby && (
              <span
                style="font-size: 0.75rem; color: var(--md-sys-color-error); font-weight: 500;"
              >
                ⚠️ Motor P2P está desligado.
              </span>
            )}
          </div>
        </div>

        {/* BOTÃO DE EXCLUIR PASTA */}
        <div
          style="margin-bottom: 24px; padding: 16px; background: var(--md-sys-color-error-container); border-radius: 12px; display: flex; justify-content: space-between; align-items: center;"
        >
          <div>
            <h4
              style="margin: 0 0 4px 0; color: var(--md-sys-color-on-error-container); font-size: 1rem;"
            >
              Zona de Perigo
            </h4>
            <p
              style="margin: 0; font-size: 0.85rem; color: var(--md-sys-color-on-error-container); opacity: 0.9;"
            >
              Excluir esta pasta removerá permanentemente todos os arquivos e metadados.
            </p>
          </div>
          <md-filled-button
            onClick={() => (confirmDeleteOpen.value = true)}
            style="--md-sys-color-primary: var(--md-sys-color-error); --md-sys-color-on-primary: var(--md-sys-color-on-error);"
          >
            <md-icon slot="icon">delete_forever</md-icon>
            Excluir Pasta
          </md-filled-button>
        </div>

        {/* TELEMETRIA */}
        {!isStandby && liveProg && (
          <div
            style="background: var(--md-sys-color-surface-container-high); padding: 16px; border-radius: 8px; margin-bottom: 24px;"
          >
            <md-linear-progress
              value={liveProg.progress / 100}
              style="width: 100%; margin-bottom: 12px;"
            ></md-linear-progress>
            <div
              style="display: flex; justify-content: space-between; font-size: 0.8rem; font-family: monospace; color: var(--md-sys-color-on-surface-variant);"
            >
              <span>Peers: {liveProg.peers}</span>
              <span>Rede: {formatSize(liveProg.speed)}/s</span>
              <span>{liveProg.progress}%</span>
            </div>
          </div>
        )}

        {/* TOOLBAR DE ARQUIVOS */}
        <div
          style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;"
        >
          <h3
            style="font-size: 1.1rem; color: var(--md-sys-color-on-surface); margin: 0; display: flex; align-items: center; gap: 8px;"
          >
            <md-icon>draft</md-icon> Arquivos Físicos ({p.value.files.length})
          </h3>
          <div style="display: flex; gap: 8px; align-items: center;">
            <md-outlined-button
              onClick={() => baixarZipPasta(p.value!.id)}
              disabled={p.value.complete !== 100 || p.value.files.length === 0}
            >
              <md-icon slot="icon">archive</md-icon> Baixar ZIP
            </md-outlined-button>
            <input
              type="file"
              multiple
              ref={appendInputRef}
              style="display: none;"
              onChange={handleAppendFiles}
            />
            <md-filled-tonal-button
              onClick={() => appendInputRef.current?.click()}
              disabled={!isStandby}
            >
              <md-icon slot="icon">add</md-icon> Adicionar
            </md-filled-tonal-button>
            {!isStandby && (
              <span
                style="font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant); margin-left: 4px;"
              >
                Pausar para editar
              </span>
            )}
          </div>
        </div>

        {/* LISTA DE ARQUIVOS */}
        <div
          style="background: var(--md-sys-color-surface); border: 1px solid var(--md-sys-color-outline-variant); border-radius: 12px; overflow: hidden;"
        >
          <md-list>
            {p.value.files.length === 0 ? (
              <div
                style="padding: 24px; text-align: center; color: var(--md-sys-color-on-surface-variant);"
              >
                A pasta está vazia.
              </div>
            ) : (
              p.value.files.map((f) => (
                <md-list-item key={f.name}>
                  <md-icon
                    slot="start"
                    style="color: var(--md-sys-color-on-surface-variant);"
                  >
                    description
                  </md-icon>
                  <div slot="headline" style="font-size: 0.9rem;">
                    {f.name}
                  </div>
                  <div slot="supporting-text" style="font-size: 0.75rem;">
                    {formatSize(f.size)}
                  </div>
                  <div slot="end" style="display: flex; gap: 4px; align-items: center;">
                    {p.value!.complete === 100 && (
                      <span
                        style="color: var(--md-sys-color-primary); font-size: 0.75rem; font-weight: bold; display: flex; align-items: center; gap: 4px; margin-right: 12px;"
                      >
                        <md-icon style="font-size: 1rem;">check_circle</md-icon>{" "}
                        OPFS
                      </span>
                    )}
                    <md-icon-button
                      onClick={() => baixarArquivoOpfs(p.value!.id, f.name)}
                      disabled={p.value?.complete !== 100}
                      title="Salvar no dispositivo"
                    >
                      <md-icon>download</md-icon>
                    </md-icon-button>
                    <md-icon-button
                      onClick={() => removerArquivoPasta(p.value!.id, f.name)}
                      disabled={!isStandby}
                      title={isStandby ? "Excluir arquivo" : "Pause para excluir"}
                    >
                      <md-icon
                        style={`color: ${
                          isStandby
                            ? "var(--md-sys-color-error)"
                            : "var(--md-sys-color-on-surface-variant)"
                        };`}
                      >
                        delete
                      </md-icon>
                    </md-icon-button>
                  </div>
                </md-list-item>
              ))
            )}
          </md-list>
        </div>

        {/* BOTÃO DE DEBUG */}
        <div style="margin-top: 24px; text-align: center;">
          <md-text-button onClick={handleDebugConsole}>
            <md-icon slot="icon">bug_report</md-icon>
            Debug (Console)
          </md-text-button>
        </div>
      </div>
    </div>
  );
}