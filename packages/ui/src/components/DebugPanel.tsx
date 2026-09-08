// src/components/DebugPanel.tsx
import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { JSX } from "preact";
import { buscarChave, salvarChave, criarStore } from "@loco/utils/db";
import { DB_NAMES } from "@loco/utils/config";

export interface DebugLogEntry {
  id: string;
  timestamp: string;
  type: "info" | "warn" | "error" | "success";
  module: string;
  message: string;
  details?: unknown;
}

const DEBUG_CONFIG_KEY = "loco_debug_enabled";
const DEBUG_LOG_PREFIX = "debug_log_";
const MAX_LOGS = 200;
const DEBUG_CHANNEL_NAME = "loco_debug_channel";

const storeConfigDB = criarStore(DB_NAMES.CONFIG);

export const isDebugEnabled = signal<boolean>(false);

buscarChave<boolean>(storeConfigDB, DEBUG_CONFIG_KEY).then((val) => {
  if (val !== undefined) {
    isDebugEnabled.value = val;
  }
});

export const debugLogs = signal<DebugLogEntry[]>(loadIndividualLogsFromStorage());

function loadIndividualLogsFromStorage(): DebugLogEntry[] {
  try {
    const logs: DebugLogEntry[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DEBUG_LOG_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const entry = JSON.parse(value) as DebugLogEntry;
            if (entry && entry.id) {
              logs.push(entry);
            }
          } catch {
            // Ignora itens corrompidos
          }
        }
      }
    }

    logs.sort((a, b) => b.id.localeCompare(a.id));
    return logs.slice(0, MAX_LOGS);
  } catch (e) {
    console.warn("Falha ao carregar logs individuais do localStorage:", e);
    return [];
  }
}

function persistSingleLog(entry: DebugLogEntry) {
  if (!isDebugEnabled.value) return;
  try {
    localStorage.setItem(`${DEBUG_LOG_PREFIX}${entry.id}`, JSON.stringify(entry));
    
    const currentLogs = debugLogs.value;
    if (currentLogs.length > MAX_LOGS) {
      const excesso = currentLogs.slice(MAX_LOGS);
      for (const old of excesso) {
        localStorage.removeItem(`${DEBUG_LOG_PREFIX}${old.id}`);
      }
      debugLogs.value = currentLogs.slice(0, MAX_LOGS);
    }
  } catch (e) {
    console.warn("Falha ao salvar log individual no localStorage:", e);
  }
}

export async function clearDebugLogs() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DEBUG_LOG_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    debugLogs.value = [];
  } catch (e) {
    console.error("Erro ao limpar logs individuais do localStorage:", e);
  }
}

const debugChannel = new BroadcastChannel(DEBUG_CHANNEL_NAME);

debugChannel.onmessage = (event) => {
  if (!isDebugEnabled.value) return;

  if (event.data && event.data.type === "LOCO_DEBUG_LOG") {
    const entry: DebugLogEntry = event.data.entry;
    if (entry && entry.id) {
      const updated = [entry, ...debugLogs.value].slice(0, MAX_LOGS);
      debugLogs.value = updated;
      persistSingleLog(entry);
    }
  }
};

const filterText = signal<string>("");
const filterType = signal<string>("all");

export function DebugPanel() {
  useEffect(() => {
    salvarChave(storeConfigDB, DEBUG_CONFIG_KEY, isDebugEnabled.value).catch((err) => {
      console.warn("Falha ao salvar configuração de debug no IndexedDB:", err);
    });
  }, [isDebugEnabled.value]);

  const filteredLogs = computed(() => {
    return debugLogs.value.filter((log) => {
      const matchesText =
        filterText.value === "" ||
        log.module.toLowerCase().includes(filterText.value.toLowerCase()) ||
        log.message.toLowerCase().includes(filterText.value.toLowerCase());

      const matchesType =
        filterType.value === "all" || log.type === filterType.value;

      return matchesText && matchesType;
    });
  });

  const toggleDebug = () => {
    isDebugEnabled.value = !isDebugEnabled.value;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <span style={styles.title}>🐞 Painel de Debug</span>
          <span style={styles.badgeCount}>{debugLogs.value.length} logs</span>
        </div>

        <div style={styles.actions}>
          <label style={styles.switchLabel}>
            <input
              type="checkbox"
              checked={isDebugEnabled.value}
              onChange={toggleDebug}
              style={styles.checkbox}
            />
            <span style={{ fontWeight: "bold", fontSize: "0.85rem" }}>
              {isDebugEnabled.value ? "LIGADO" : "DESLIGADO"}
            </span>
          </label>

          <md-outlined-button
            onClick={clearDebugLogs}
            disabled={debugLogs.value.length === 0}
          >
            Limpar
          </md-outlined-button>
        </div>
      </div>

      <div style={styles.filterBar}>
        <input
          type="text"
          placeholder="Filtrar por módulo ou mensagem..."
          value={filterText.value}
          onInput={(e) => (filterText.value = (e.target as HTMLInputElement).value)}
          style={styles.searchInput}
        />

        <select
          value={filterType.value}
          onChange={(e) => (filterType.value = (e.target as HTMLSelectElement).value)}
          style={styles.selectInput}
        >
          <option value="all">Todos os tipos</option>
          <option value="info">Info</option>
          <option value="warn">Avisos (Warn)</option>
          <option value="error">Erros</option>
          <option value="success">Sucesso</option>
        </select>
      </div>

      <div style={styles.logList}>
        {!isDebugEnabled.value && (
          <div style={styles.disabledNotice}>
            ⚠️ O modo Debug está <strong>DESLIGADO</strong>. O painel não está registrando novas mensagens.
          </div>
        )}

        {filteredLogs.value.length === 0 ? (
          <div style={styles.emptyState}>Nenhum log gravado.</div>
        ) : (
          filteredLogs.value.map((log) => (
            <div key={log.id} style={{ ...styles.logItem, ...getTypeStyle(log.type) }}>
              <div style={styles.logMeta}>
                <span style={styles.time}>{log.timestamp}</span>
                <span style={styles.module}>[{log.module}]</span>
                <span style={{ ...styles.typeTag, ...getTypeBadgeStyle(log.type) }}>
                  {log.type.toUpperCase()}
                </span>
              </div>
              <div style={styles.message}>{log.message}</div>
              {log.details !== undefined && (
                <details style={styles.details}>
                  <summary style={styles.summary}>Ver detalhes JSON</summary>
                  <pre style={styles.json}>{JSON.stringify(log.details, null, 2)}</pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getTypeStyle(type: DebugLogEntry["type"]): JSX.CSSProperties {
  switch (type) {
    case "error":
      return { borderLeft: "4px solid #f44336", backgroundColor: "rgba(244, 67, 54, 0.05)" };
    case "warn":
      return { borderLeft: "4px solid #ff9800", backgroundColor: "rgba(255, 152, 0, 0.05)" };
    case "success":
      return { borderLeft: "4px solid #4caf50", backgroundColor: "rgba(76, 175, 80, 0.05)" };
    default:
      return { borderLeft: "4px solid #2196f3", backgroundColor: "rgba(33, 150, 243, 0.05)" };
  }
}

function getTypeBadgeStyle(type: DebugLogEntry["type"]): JSX.CSSProperties {
  switch (type) {
    case "error":
      return { color: "#d32f2f" };
    case "warn":
      return { color: "#ed6c02" };
    case "success":
      return { color: "#2e7d32" };
    default:
      return { color: "#0288d1" };
  }
}

const styles: Record<string, JSX.CSSProperties> = {
  container: {
    display: "flex", flexDirection: "column", gap: "12px", padding: "16px",
    backgroundColor: "var(--md-sys-color-surface-container, #f5f5f5)", borderRadius: "12px",
    border: "1px solid var(--md-sys-color-outline-variant, #e0e0e0)", fontFamily: "monospace",
    fontSize: "0.85rem", maxHeight: "600px",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" },
  titleGroup: { display: "flex", alignItems: "center", gap: "8px" },
  title: { fontSize: "1rem", fontWeight: "bold" },
  badgeCount: { fontSize: "0.75rem", padding: "2px 8px", borderRadius: "12px", backgroundColor: "var(--md-sys-color-secondary-container, #e0e0e0)" },
  actions: { display: "flex", alignItems: "center", gap: "12px" },
  switchLabel: { display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", userSelect: "none" },
  checkbox: { cursor: "pointer", width: "16px", height: "16px" },
  filterBar: { display: "flex", gap: "8px" },
  searchInput: { flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" },
  selectInput: { padding: "6px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" },
  logList: { display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", maxHeight: "450px", paddingRight: "4px" },
  disabledNotice: { padding: "10px", backgroundColor: "#fff3cd", color: "#856404", borderRadius: "6px", fontSize: "0.8rem" },
  emptyState: { textAlign: "center", padding: "24px", color: "#888" },
  logItem: { padding: "8px 12px", borderRadius: "6px", display: "flex", flexDirection: "column", gap: "4px" },
  logMeta: { display: "flex", gap: "8px", alignItems: "center", fontSize: "0.75rem" },
  time: { color: "#666" },
  module: { fontWeight: "bold", color: "#333" },
  typeTag: { fontWeight: "bold" },
  message: { wordBreak: "break-word", whiteSpace: "pre-wrap" },
  details: { marginTop: "4px" },
  summary: { cursor: "pointer", color: "#0066cc", fontSize: "0.75rem" },
  json: { margin: "4px 0 0 0", padding: "8px", backgroundColor: "#1e1e1e", color: "#00ff66", borderRadius: "4px", fontSize: "0.75rem", overflowX: "auto" },
};