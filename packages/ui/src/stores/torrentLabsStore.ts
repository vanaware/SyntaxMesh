// Arquivo: monorepo/ui/src/stores/torrentLabsStore.ts
import { signal } from "@preact/signals";
import { zipSync } from "fflate";
import { addDebugLog, showToast } from "./state.ts";
import { salvarNoOPFS, lerDoOPFS, excluirDoOPFS } from "../worker-opfs/opfs-utils.ts";
import { webTorrent } from "@loco/utils/webtorrent";
import {
  salvarPastaMetadata,
  listarTodasAsPastas,
  buscarPastaMetadata,
  removerPastaMetadata,
  gerarId,
} from "@loco/utils/db";
import type { PastaMetadata, FileMetadata } from "@loco/utils/interfaces";

// ============================================================================
// SIGNALS (API pública)
// ============================================================================
export const isMotorLigar = signal<boolean>(false);
export const pastasAtivas = signal<PastaMetadata[]>([]);
export const progressoMap = signal<
  Record<string, { progress: number; speed: number; peers: number }>
>({});

const RELIABLE_TRACKERS = [
  "wss://tracker.webtorrent.dev:443",
  "wss://tracker.openwebtorrent.com:443",
  "wss://open.ftorrent.com:443",
];

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================
export async function carregarPastasDoBanco() {
  const todas = await listarTodasAsPastas();
  pastasAtivas.value = todas.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export async function initTorrentLabsStore() {
  await carregarPastasDoBanco();
}

// ============================================================================
// MOTOR P2P — delega ao wrapper
// ============================================================================
export async function alternarMotor() {
  if (isMotorLigar.value) {
    // --- DESLIGAR ---
    try {
      await webTorrent.stopWebTorrent();
    } catch (e: any) {
      addDebugLog("warn", "TORRENT_LAB", `Erro ao parar motor: ${e.message}`);
    }
    isMotorLigar.value = false;
    progressoMap.value = {};
    addDebugLog("info", "TORRENT_LAB", "Motor WebTorrent desligado via wrapper.");
  } else {
    // --- LIGAR ---
    try {
      await webTorrent.startWebTorrent();
      isMotorLigar.value = true;
      addDebugLog(
        "success",
        "TORRENT_LAB",
        "Motor WebTorrent ligado e handshake com SW concluído.",
      );

      // Ressemeia pastas que estavam ativas
      await carregarPastasDoBanco();
      for (const pasta of pastasAtivas.value) {
        if (pasta.status !== "standby") {
          await reseedPasta(pasta.id);
        }
      }
    } catch (err: any) {
      isMotorLigar.value = false;
      addDebugLog("error", "TORRENT_LAB", `Falha ao iniciar motor: ${err.message}`);
      showToast(`❌ Motor P2P: ${err.message}`, "error");
    }
  }
}

// ============================================================================
// CRIAÇÃO OFFLINE DE PASTAS (usa opfs-utils)
// ============================================================================
export async function criarNovaPastaOffline(
  nomePasta: string,
  arquivosInput: FileList | File[],
  permissao: "public" | "listed" | "trusted" = "trusted",
) {
  const id = gerarId();
  const agora = Date.now();
  const fileArray = Array.from(arquivosInput);
  const fileMetadatas: FileMetadata[] = [];

  for (const f of fileArray) {
    await salvarNoOPFS(id, f.name, f);
    fileMetadatas.push({
      name: f.name,
      size: f.size,
      type: f.type,
      createdAt: agora,
      modifiedAt: agora,
    });
  }

  const novaPasta: PastaMetadata = {
    id,
    name: nomePasta,
    status: "standby",
    complete: 100,
    permission: permissao,
    contatos: [],
    files: fileMetadatas,
    createdAt: agora,
    modifiedAt: agora,
  };

  await salvarPastaMetadata(novaPasta);
  await carregarPastasDoBanco();
  addDebugLog(
    "success",
    "TORRENT_LAB",
    `Pasta '${nomePasta}' criada Offline no OPFS.`,
  );

  // Se o motor já está ligado, ativa imediatamente
  if (isMotorLigar.value && webTorrent.isReady) {
    novaPasta.status = "seeding";
    await salvarPastaMetadata(novaPasta);
    await reseedPasta(id);
  }
}

// ============================================================================
// SEED — usa webTorrent.seed() do wrapper
// Aguarda evento 'ready' para garantir magnetURI disponível
// ============================================================================
export async function reseedPasta(pastaId: string) {
  const pasta = await buscarPastaMetadata(pastaId);
  if (
    !pasta ||
    pasta.status === "downloading" ||
    pasta.status === "standby" ||
    !isMotorLigar.value ||
    !webTorrent.isReady
  ) {
    return;
  }

  // Se já existe um torrent ativo para esta pasta, destrói antes de ressemear
  if (pasta.infoHash || pasta.magnetURI) {
    try {
      const existente = await webTorrent.get(pasta.infoHash || pasta.magnetURI!);
      if (existente) {
        await webTorrent.remove(existente);
      }
    } catch {
      // torrent já não existe — ok
    }
  }

  // Lê os arquivos do OPFS (modo offline) para montar o seed
  const filesToSeed: File[] = [];
  for (const f of pasta.files) {
    const file = await lerDoOPFS(pasta.id, f.name);
    if (file) filesToSeed.push(file);
  }

  // Cria o manifesto .loco-manifest.json
  const manifesto = { id: pasta.id, name: pasta.name };
  const manifestBlob = new Blob([JSON.stringify(manifesto, null, 2)], {
    type: "application/json",
  });
  const manifestFile = new File([manifestBlob], ".loco-manifest.json", {
    type: "application/json",
  });
  filesToSeed.push(manifestFile);

  if (filesToSeed.length === 0) {
    addDebugLog("warn", "TORRENT_LAB", `Pasta '${pasta.name}' sem arquivos para seed.`);
    return;
  }

  // Seed via wrapper — OPFS é gerenciado internamente
  const torrent = await webTorrent.seed(filesToSeed, {
    announce: RELIABLE_TRACKERS,
    name: pasta.name,
  });

  // O magnetURI só fica disponível após o infoHash ser computado assincronamente
  if (!torrent.infoHash) {
    await new Promise<void>((resolve) => {
      torrent.once("infoHash", () => resolve());
      torrent.once("ready", () => resolve());
    });
  }

  // Agora o magnetURI está garantidamente disponível
  pasta.magnetURI = torrent.magnetURI;
  pasta.infoHash = torrent.infoHash;
  pasta.status = "seeding";
  await salvarPastaMetadata(pasta);
  await carregarPastasDoBanco();
  _anexarEventosTorrent(torrent, pasta.id);

  addDebugLog(
    "info",
    "TORRENT_LAB",
    `Seed da pasta '${pasta.name}' reconstruído via wrapper. Magnet: ${torrent.magnetURI?.substring(0, 40)}...`,
  );
}

// ============================================================================
// GESTÃO DE ARQUIVOS EM PASTAS STANDBY (opfs-utils)
// ============================================================================
export async function adicionarArquivosPasta(
  pastaId: string,
  novosArquivos: FileList | File[],
) {
  const pasta = await buscarPastaMetadata(pastaId);
  if (!pasta) return;
  if (pasta.status !== "standby") {
    showToast("Coloque a pasta em Standby para adicionar arquivos.", "error");
    return;
  }

  const agora = Date.now();
  const fileArray = Array.from(novosArquivos);
  for (const f of fileArray) {
    await salvarNoOPFS(pasta.id, f.name, f);
    const existIndex = pasta.files.findIndex((x) => x.name === f.name);
    const meta: FileMetadata = {
      name: f.name,
      size: f.size,
      type: f.type,
      createdAt: agora,
      modifiedAt: agora,
    };
    if (existIndex >= 0) pasta.files[existIndex] = meta;
    else pasta.files.push(meta);
  }

  pasta.modifiedAt = agora;
  pasta.magnetURI = undefined;
  pasta.infoHash = undefined;
  await salvarPastaMetadata(pasta);
  await carregarPastasDoBanco();
  showToast("Arquivos anexados. Ative a pasta para gerar o novo Seed.", "success");
}

export async function removerArquivoPasta(pastaId: string, fileName: string) {
  const pasta = await buscarPastaMetadata(pastaId);
  if (!pasta) return;
  if (pasta.status !== "standby") {
    showToast("Coloque a pasta em Standby para excluir arquivos.", "error");
    return;
  }

  await excluirDoOPFS(pasta.id, fileName);
  pasta.files = pasta.files.filter((f) => f.name !== fileName);
  pasta.modifiedAt = Date.now();
  pasta.magnetURI = undefined;
  pasta.infoHash = undefined;
  await salvarPastaMetadata(pasta);
  await carregarPastasDoBanco();
  showToast("Arquivo removido. Ative a pasta para gerar o novo Seed.", "info");
}

// ============================================================================
// PERMISSÕES
// ============================================================================
export async function atualizarPermissaoPasta(
  pastaId: string,
  novaPermissao: "public" | "listed" | "trusted",
) {
  const pasta = await buscarPastaMetadata(pastaId);
  if (!pasta) return;
  pasta.permission = novaPermissao;
  pasta.modifiedAt = Date.now();
  await salvarPastaMetadata(pasta);
  await carregarPastasDoBanco();
  showToast("Permissão de acesso atualizada internamente.", "success");
}

// ============================================================================
// DOWNLOAD DE ARQUIVOS — adapta para API de ficheiros do torrent
// ============================================================================
export async function baixarArquivoOpfs(pastaId: string, fileName: string) {
  const pasta = await buscarPastaMetadata(pastaId);
  if (!pasta) {
    showToast("Pasta não encontrada.", "error");
    return;
  }

  let blob: Blob | null = null;

  // 1. Tenta via torrent ativo (API de ficheiros do WebTorrent)
  if ((pasta.infoHash || pasta.magnetURI) && isMotorLigar.value && webTorrent.isReady) {
    try {
      const torrent = await webTorrent.get(pasta.infoHash || pasta.magnetURI!);
      if (torrent) {
        const file = torrent.files.find((f: any) => f.name === fileName);
        if (file) {
          blob = await (file as any).blob();
        }
      }
    } catch {
      // fallback para OPFS
    }
  }

  // 2. Fallback: OPFS manual (modo standby)
  if (!blob) {
    const file = await lerDoOPFS(pastaId, fileName);
    if (file) blob = file;
  }

  if (!blob) {
    showToast("Arquivo não encontrado no disco local.", "error");
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// ZIP — adapta para API de ficheiros do torrent
// ============================================================================
export async function baixarZipPasta(pastaId: string) {
  const pasta = await buscarPastaMetadata(pastaId);
  if (!pasta || pasta.files.length === 0) {
    showToast("A pasta está vazia.", "error");
    return;
  }

  showToast("Compactando pasta em ZIP. Aguarde...", "info");

  try {
    const zipObj: Record<string, Uint8Array> = {};

    // Tenta via torrent ativo primeiro
    let torrentAtivo: any = null;
    if ((pasta.infoHash || pasta.magnetURI) && isMotorLigar.value && webTorrent.isReady) {
      try {
        torrentAtivo = await webTorrent.get(pasta.infoHash || pasta.magnetURI!);
      } catch {
        // sem torrent ativo
      }
    }

    for (const f of pasta.files) {
      let blob: Blob | null = null;

      if (torrentAtivo) {
        const tFile = torrentAtivo.files.find((tf: any) => tf.name === f.name);
        if (tFile) {
          try {
            blob = await (tFile as any).blob();
          } catch {
            // fallback
          }
        }
      }

      if (!blob) {
        const file = await lerDoOPFS(pastaId, f.name);
        if (file) blob = file;
      }

      if (blob) {
        zipObj[f.name] = new Uint8Array(await blob.arrayBuffer());
      }
    }

    if (Object.keys(zipObj).length === 0) {
      showToast("Nenhum arquivo disponível para compactar.", "error");
      return;
    }

    const zipped = zipSync(zipObj);
    const blob = new Blob([new Uint8Array(zipped)], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pasta.name}_P2P.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Download do ZIP concluído!", "success");
  } catch (e: any) {
    addDebugLog("error", "TORRENT_LAB", "Falha ao gerar ZIP", e.message);
    showToast("Erro ao compactar arquivos.", "error");
  }
}

// ============================================================================
// DOWNLOAD VIA MAGNET — usa webTorrent.add() (síncrono)
// ============================================================================
export async function adicionarMagnetDownload(magnetURI: string) {
  if (!isMotorLigar.value || !webTorrent.isReady) {
    showToast("Ligue o Motor P2P primeiro.", "error");
    addDebugLog("error", "TORRENT_LAB", "Tentativa de download com motor desligado.");
    return;
  }

  if (!magnetURI || !magnetURI.trim()) {
    showToast("Magnet URI vazio.", "error");
    return;
  }

  if (!magnetURI.startsWith("magnet:")) {
    showToast("Formato inválido. Deve começar com 'magnet:'.", "error");
    return;
  }

  addDebugLog(
    "info",
    "TORRENT_LAB",
    `Iniciando download via magnet: ${magnetURI.substring(0, 60)}...`,
  );
  showToast("Iniciando download P2P...", "info");

  try {
    // 🔥 add() é SÍNCRONO — retorna Torrent imediatamente
    const torrent = webTorrent.add(magnetURI, {
      announce: RELIABLE_TRACKERS,
    });

    addDebugLog("info", "TORRENT_LAB", `Torrent criado. Aguardando metadata...`);

    // Timeout de 30s para receber metadata
    const metadataTimeout = setTimeout(() => {
      addDebugLog(
        "warn",
        "TORRENT_LAB",
        "Timeout: Metadata não recebido em 30s. Verifique se o seeder está online.",
      );
      showToast(
        "⚠️ Timeout: Não foi possível conectar ao seeder. Verifique se o outro dispositivo está online e com o motor ligado.",
        "error",
      );
      // Remove o torrent órfão
      webTorrent.remove(torrent).catch(() => {});
    }, 30000);

    torrent.on("metadata", () => {
      clearTimeout(metadataTimeout);
      addDebugLog("success", "TORRENT_LAB", "Metadata recebido! Processando manifesto...");

      const manifestTorrentFile = torrent.files.find(
        (f: any) => f.name === ".loco-manifest.json",
      );

      if (!manifestTorrentFile) {
        addDebugLog(
          "error",
          "TORRENT_LAB",
          "Manifesto .loco-manifest.json não encontrado no torrent.",
        );
        showToast("❌ Torrent inválido: manifesto não encontrado.", "error");
        webTorrent.remove(torrent).catch(() => {});
        return;
      }

      (manifestTorrentFile as any).getBuffer(
        async (err: any, buffer?: Uint8Array) => {
          if (err || !buffer) {
            addDebugLog(
              "error",
              "TORRENT_LAB",
              `Erro ao ler manifesto: ${err?.message || "buffer vazio"}`,
            );
            showToast("Erro ao ler manifesto do torrent.", "error");
            return;
          }

          try {
            const manifestStr = new TextDecoder().decode(buffer);
            const manifestJson = JSON.parse(manifestStr);
            const realId: string = manifestJson.id;
            const agora = Date.now();

            addDebugLog("info", "TORRENT_LAB", `Manifesto parseado. ID da pasta: ${realId}`);

            const existe = await buscarPastaMetadata(realId);
            if (existe) {
              await webTorrent.remove(torrent);
              showToast("Você já possui esta pasta.", "info");
              addDebugLog("info", "TORRENT_LAB", "Pasta já existe no banco local.");
              return;
            }

            const fileMetadatas: FileMetadata[] = torrent.files
              .filter((f: any) => f.name !== ".loco-manifest.json")
              .map((f: any) => ({
                name: f.name,
                size: f.length,
                type: "application/octet-stream",
                createdAt: agora,
                modifiedAt: agora,
              }));

            const novaPasta: PastaMetadata = {
              id: realId,
              name: manifestJson.name || torrent.name,
              magnetURI: torrent.magnetURI,
              infoHash: torrent.infoHash,
              status: "downloading",
              complete: 0,
              permission: "trusted",
              contatos: [],
              files: fileMetadatas,
              createdAt: agora,
              modifiedAt: agora,
            };

            await salvarPastaMetadata(novaPasta);
            await carregarPastasDoBanco();
            _anexarEventosTorrent(torrent, realId);

            addDebugLog(
              "success",
              "TORRENT_LAB",
              `Pasta '${novaPasta.name}' criada e download iniciado.`,
            );
            showToast(`✅ Download iniciado: ${novaPasta.name}`, "success");
          } catch (parseErr: any) {
            addDebugLog(
              "error",
              "TORRENT_LAB",
              `Erro de Parse no manifesto: ${parseErr.message}`,
            );
            showToast("Erro ao processar manifesto do torrent.", "error");
          }
        },
      );
    });

    torrent.on("error", (err: any) => {
      clearTimeout(metadataTimeout);
      addDebugLog("error", "TORRENT_LAB", `Erro no torrent: ${err?.message || err}`);
      showToast(
        `❌ Erro no download: ${err?.message || "Erro desconhecido"}`,
        "error",
      );
    });

    torrent.on("warning", (err: any) => {
      addDebugLog("warn", "TORRENT_LAB", `Aviso: ${err?.message || err}`);
    });
  } catch (err: any) {
    addDebugLog("error", "TORRENT_LAB", `Erro ao adicionar magnet: ${err.message}`);
    showToast(`Erro ao iniciar download: ${err.message}`, "error");
  }
}

// ============================================================================
// ALTERNAR STATUS (Standby ↔ Ativo)
// ============================================================================
export async function alternarStatusPasta(pastaId: string) {
  const pasta = await buscarPastaMetadata(pastaId);
  if (!pasta) return;

  if (pasta.status === "standby") {
    // --- ATIVAR ---
    pasta.status = pasta.complete === 100 ? "seeding" : "downloading";
    await salvarPastaMetadata(pasta);
    await carregarPastasDoBanco();

    if (isMotorLigar.value && webTorrent.isReady) {
      if (pasta.status === "seeding") {
        await reseedPasta(pasta.id);
      } else if (pasta.magnetURI) {
        // 🔥 add() é SÍNCRONO
        const torrent = webTorrent.add(pasta.magnetURI, {
          announce: RELIABLE_TRACKERS,
        });
        _anexarEventosTorrent(torrent, pasta.id);
      }
    }
  } else {
    // --- COLOCAR EM STANDBY ---
    pasta.status = "standby";

    // Remove o torrent do wrapper (sem destruir os ficheiros OPFS do seed)
    if (isMotorLigar.value && webTorrent.isReady && (pasta.infoHash || pasta.magnetURI)) {
      try {
        const torrent = await webTorrent.get(pasta.infoHash || pasta.magnetURI!);
        if (torrent) {
          await webTorrent.remove(torrent);
        }
      } catch {
        // torrent já não existe
      }
    }

    const novoMapa = { ...progressoMap.value };
    delete novoMapa[pastaId];
    progressoMap.value = novoMapa;

    await salvarPastaMetadata(pasta);
    await carregarPastasDoBanco();
  }
}

// ============================================================================
// EXCLUSÃO COMPLETA DE PASTA
// ============================================================================
export async function excluirPasta(pastaId: string): Promise<boolean> {
  const pasta = await buscarPastaMetadata(pastaId);
  if (!pasta) {
    showToast("Pasta não encontrada.", "error");
    return false;
  }

  addDebugLog("info", "TORRENT_LAB", `Iniciando exclusão da pasta '${pasta.name}'...`);

  // 1. Remove o torrent ativo se existir
  const torrentId = pasta.infoHash || pasta.magnetURI;
  if (torrentId && isMotorLigar.value && webTorrent.isReady) {
    try {
      const torrentObj = await webTorrent.get(torrentId);
      if (torrentObj) {
        await webTorrent.remove(torrentObj, { destroyStore: true });
        addDebugLog("info", "TORRENT_LAB", `Torrent ${torrentId} removido.`);
      }
    } catch (err: any) {
      addDebugLog("warn", "TORRENT_LAB", `Erro ao remover torrent: ${err.message}`);
    }
  }

  // 2. Remove todos os arquivos do OPFS
  for (const f of pasta.files) {
    try {
      await excluirDoOPFS(pasta.id, f.name);
    } catch (err: any) {
      addDebugLog(
        "warn",
        "TORRENT_LAB",
        `Erro ao excluir arquivo ${f.name}: ${err.message}`,
      );
    }
  }
  // Remove também o manifesto
  try {
    await excluirDoOPFS(pasta.id, ".loco-manifest.json");
  } catch {
    // manifesto pode não existir
  }

  // 3. Remove a metadata do IndexedDB
  try {
    await removerPastaMetadata(pastaId);
    addDebugLog("success", "TORRENT_LAB", `Pasta '${pasta.name}' excluída com sucesso.`);
  } catch (err: any) {
    addDebugLog("error", "TORRENT_LAB", `Erro ao remover metadata: ${err.message}`);
    showToast("Erro ao excluir pasta do banco de dados.", "error");
    return false;
  }

  // 4. Remove do mapa de progresso se existir
  const novoMapa = { ...progressoMap.value };
  delete novoMapa[pastaId];
  progressoMap.value = novoMapa;

  // 5. Atualiza a lista de pastas
  await carregarPastasDoBanco();
  showToast(`Pasta '${pasta.name}' excluída permanentemente.`, "success");
  return true;
}

// ============================================================================
// EVENTOS DE TELEMETRIA DO TORRENT
// ============================================================================
function _anexarEventosTorrent(torrent: any, pastaId: string) {
  torrent.on("download", () => {
    progressoMap.value = {
      ...progressoMap.value,
      [pastaId]: {
        progress: Math.round(torrent.progress * 100),
        speed: torrent.downloadSpeed,
        peers: torrent.numPeers,
      },
    };
  });

  torrent.on("upload", () => {
    // Atualiza peers durante seeding
    const atual = progressoMap.value[pastaId];
    if (atual) {
      progressoMap.value = {
        ...progressoMap.value,
        [pastaId]: { ...atual, peers: torrent.numPeers },
      };
    }
  });

  torrent.on("done", async () => {
    progressoMap.value = {
      ...progressoMap.value,
      [pastaId]: { progress: 100, speed: 0, peers: torrent.numPeers },
    };

    const pasta = await buscarPastaMetadata(pastaId);
    if (pasta) {
      pasta.complete = 100;
      pasta.status = "seeding";
      await salvarPastaMetadata(pasta);
      await carregarPastasDoBanco();
    }

    // Salva cada ficheiro no OPFS manual (para acesso em standby futuro)
    for (const file of torrent.files) {
      if (file.name === ".loco-manifest.json") continue;
      (file as any).getBlob(async (err: any, blob: Blob | undefined) => {
        if (!err && blob) {
          await salvarNoOPFS(pastaId, file.name, blob);
        }
      });
    }
  });

  torrent.on("error", (err: any) => {
    addDebugLog(
      "error",
      "TORRENT_LAB",
      `Erro no torrent da pasta ${pastaId}: ${err.message || err}`,
    );
  });
}