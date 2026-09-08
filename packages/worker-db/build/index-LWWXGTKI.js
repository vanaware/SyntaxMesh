// src/utils/id-utils.ts
function gerarId() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("").substring(0, 12);
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
function gerarIdComPrefixo(prefix) {
  return `${prefix}${gerarId()}`;
}
function formatDbItem(key, val, prefix = "") {
  if (!val || typeof val !== "object" || Array.isArray(val)) return val;
  const keyStr = String(key);
  const _id = prefix && keyStr.startsWith(prefix) ? keyStr.slice(prefix.length) : keyStr;
  return {
    _id,
    ...val
  };
}
function prepareForSave(key, val, prefix = "") {
  let rawId = val && typeof val === "object" ? val._id : void 0;
  if (rawId === "auto") {
    rawId = gerarId();
  }
  let processKey = key === "auto" ? gerarId() : key;
  let finalKey = processKey || "";
  if (rawId) {
    if (prefix && rawId.startsWith(prefix)) {
      finalKey = rawId;
    } else {
      finalKey = prefix ? `${prefix}${rawId}` : rawId;
    }
  } else if (processKey) {
    if (prefix && processKey.startsWith(prefix)) {
      finalKey = processKey;
    } else {
      finalKey = prefix ? `${prefix}${processKey}` : processKey;
    }
  }
  if (!finalKey) {
    throw new Error("Uma chave (key) ou um atributo '_id' no objeto deve ser fornecido.");
  }
  if (val && typeof val === "object" && !Array.isArray(val) && "_id" in val) {
    const { _id: _, ...cleanVal } = val;
    return {
      key: finalKey,
      cleanVal
    };
  }
  return {
    key: finalKey,
    cleanVal: val
  };
}

// src/ls.ts
function getAllPrefixedEntries(prefix = "") {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (!prefix || key.startsWith(prefix))) {
      const rawVal = localStorage.getItem(key);
      if (rawVal !== null) {
        try {
          entries.push([
            key,
            JSON.parse(rawVal)
          ]);
        } catch {
        }
      }
    }
  }
  return entries;
}
function getFormattedItems(prefix = "") {
  const rawEntries = getAllPrefixedEntries(prefix);
  return rawEntries.map(([k, v]) => formatDbItem(k, v, prefix));
}
function resolveKey(key, prefix = "") {
  return prefix && !key.startsWith(prefix) ? `${prefix}${key}` : key;
}
function createScopedLs(prefix = "") {
  return {
    get: (key) => {
      const fullKey = resolveKey(key, prefix);
      const raw = localStorage.getItem(fullKey);
      if (raw === null) return void 0;
      try {
        return formatDbItem(fullKey, JSON.parse(raw), prefix);
      } catch {
        return void 0;
      }
    },
    set: (keyOrVal, val) => {
      let key;
      let targetVal;
      if (typeof keyOrVal === "string") {
        key = keyOrVal;
        targetVal = val;
      } else {
        key = void 0;
        targetVal = keyOrVal;
      }
      const { key: finalKey, cleanVal } = prepareForSave(key, targetVal, prefix);
      localStorage.setItem(finalKey, JSON.stringify(cleanVal));
      return finalKey;
    },
    patch: (key, patchOrFn, context) => {
      const current = createScopedLs(prefix).get(key) || {};
      let updated;
      if (typeof patchOrFn === "function") {
        updated = patchOrFn(current, context);
      } else {
        updated = Object.assign({}, current, patchOrFn);
      }
      const { key: finalKey, cleanVal } = prepareForSave(key, updated, prefix);
      localStorage.setItem(finalKey, JSON.stringify(cleanVal));
      return formatDbItem(finalKey, cleanVal, prefix);
    },
    delete: (key) => {
      localStorage.removeItem(resolveKey(key, prefix));
    },
    getMany: (keys) => {
      const api = createScopedLs(prefix);
      return keys.map((k) => api.get(k));
    },
    setMany: (entries) => {
      const api = createScopedLs(prefix);
      entries.forEach(([k, v]) => api.set(k, v));
    },
    deleteMany: (keys) => {
      const api = createScopedLs(prefix);
      keys.forEach((k) => api.delete(k));
    },
    keys: () => {
      const keysList = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (!prefix || k.startsWith(prefix))) {
          keysList.push(k);
        }
      }
      return keysList;
    },
    values: () => {
      return getFormattedItems(prefix);
    },
    entries: () => {
      return getAllPrefixedEntries(prefix);
    },
    clear: () => {
      if (!prefix) {
        localStorage.clear();
        return;
      }
      const keysToRemove = createScopedLs(prefix).keys();
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    },
    query: (fn, context) => {
      const items = getFormattedItems(prefix);
      return fn(items, context);
    },
    getSome: (fn, context) => {
      const items = getFormattedItems(prefix);
      const selected = fn(items, context);
      if (!Array.isArray(selected)) {
        throw new Error("A fun\xE7\xE3o em getSome deve retornar um Array.");
      }
      return selected;
    },
    delSome: (fn, context) => {
      const items = getFormattedItems(prefix);
      const selected = fn(items, context);
      if (!Array.isArray(selected)) {
        throw new Error("A fun\xE7\xE3o em delSome deve retornar um Array.");
      }
      selected.forEach((item) => {
        if (!item || item._id === void 0) {
          throw new Error("Os itens retornados em delSome precisam conter a propriedade '_id'.");
        }
        const rawKey = prefix && !item._id.startsWith(prefix) ? `${prefix}${item._id}` : item._id;
        localStorage.removeItem(rawKey);
      });
    },
    setSome: (selectFn, updateFn, context) => {
      const items = getFormattedItems(prefix);
      const selected = selectFn(items, context);
      if (!Array.isArray(selected)) {
        throw new Error("A fun\xE7\xE3o de sele\xE7\xE3o em setSome deve retornar um Array.");
      }
      selected.forEach((item) => {
        if (!item || item._id === void 0) {
          throw new Error("Os itens selecionados em setSome precisam conter a propriedade '_id'.");
        }
        const updatedItem = updateFn(item, context);
        const { key: finalKey, cleanVal } = prepareForSave(void 0, updatedItem, prefix);
        localStorage.setItem(finalKey, JSON.stringify(cleanVal));
      });
    },
    // --- MÉTODOS DE EXPORTAÇÃO / IMPORTAÇÃO ---
    exportLS: () => {
      const allEntries = getAllPrefixedEntries(prefix);
      return Object.fromEntries(allEntries);
    },
    importLS: (data, clearFirst = false) => {
      const api = createScopedLs(prefix);
      if (clearFirst) api.clear();
      Object.entries(data).forEach(([k, v]) => api.set(k, v));
    },
    backupToOpfs: async (recordKey, fileName = "backup.json") => {
      const data = Object.fromEntries(getAllPrefixedEntries(prefix));
      const blob = new Blob([
        JSON.stringify(data)
      ], {
        type: "application/json"
      });
      const drive = opfs("LS_SYS", "ls_store", prefix, "backup");
      await drive.addFile(recordKey, blob, fileName);
      return `${recordKey}/${fileName}`;
    },
    restoreFromOpfs: async (recordKey, fileName, clearFirst = false) => {
      const drive = opfs("LS_SYS", "ls_store", prefix, "backup");
      const fileBlob = await drive.getFile(recordKey, fileName);
      const data = JSON.parse(await fileBlob.text());
      const api = createScopedLs(prefix);
      if (clearFirst) api.clear();
      Object.entries(data).forEach(([k, v]) => api.set(k, v));
    },
    gerarId,
    gerarIdComPrefixo: () => prefix ? gerarIdComPrefixo(prefix) : gerarId()
  };
}
var ls = Object.assign((prefix = "") => createScopedLs(prefix), createScopedLs());

// src/mod.ts
var workerInstance = null;
var currentWorkerPath = "./worker-db.js";
var pendingRequests = /* @__PURE__ */ new Map();
function getWorker(workerPath) {
  if (workerPath) {
    currentWorkerPath = workerPath;
  }
  if (!workerInstance) {
    const workerUrl = typeof currentWorkerPath === "string" ? new URL(currentWorkerPath, import.meta.url) : currentWorkerPath;
    workerInstance = new Worker(workerUrl, {
      type: "module"
    });
    workerInstance.onmessage = (e) => {
      const { requestId, success, result, error } = e.data;
      const promise = pendingRequests.get(requestId);
      if (promise) {
        if (success) promise.resolve(result);
        else promise.reject(new Error(error));
        pendingRequests.delete(requestId);
      }
    };
    workerInstance.onerror = (event) => {
      console.error("\u26A0\uFE0F Falha cr\xEDtica no Web Worker:", event.message);
      pendingRequests.forEach(({ reject }) => reject(new Error("Worker crashed")));
      pendingRequests.clear();
      restartWorker();
    };
  }
  return workerInstance;
}
function restartWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
  pendingRequests.forEach(({ reject }) => reject(new Error("Worker foi reiniciado")));
  pendingRequests.clear();
  getWorker();
}
function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}
function exec(command, args = {}) {
  return new Promise((resolve, reject) => {
    const requestId = gerarId();
    pendingRequests.set(requestId, {
      resolve,
      reject
    });
    try {
      getWorker().postMessage({
        requestId,
        command,
        args
      });
    } catch (err) {
      pendingRequests.delete(requestId);
      reject(err);
    }
  });
}
var globalDbAPI = {
  get: (key, opts) => exec("GET", {
    key,
    ...opts
  }),
  set: (keyOrVal, val, opts) => {
    if (typeof keyOrVal !== "string") {
      const options = opts || val || {};
      return exec("SET", {
        key: void 0,
        val: keyOrVal,
        ...options
      });
    }
    return exec("SET", {
      key: keyOrVal,
      val,
      ...opts
    });
  },
  update: async (key, updater, opts) => {
    const currentVal = await exec("GET", {
      key,
      ...opts
    });
    const newVal = updater(currentVal);
    await exec("SET", {
      key,
      val: newVal,
      ...opts
    });
  },
  patch: (key, patchOrFn, context, opts) => {
    const isFn = typeof patchOrFn === "function";
    return exec("PATCH", {
      key,
      patch: isFn ? void 0 : patchOrFn,
      fnStr: isFn ? patchOrFn.toString() : void 0,
      context,
      ...opts
    });
  },
  delete: (key, opts) => exec("DELETE", {
    key,
    ...opts
  }),
  getMany: (keys, opts) => exec("GET_MANY", {
    keys,
    ...opts
  }),
  setMany: (entries, opts) => exec("SET_MANY", {
    entries,
    ...opts
  }),
  deleteMany: (keys, opts) => exec("DEL_MANY", {
    keys,
    ...opts
  }),
  keys: (opts) => exec("KEYS", {
    ...opts
  }),
  values: (opts) => exec("VALUES", {
    ...opts
  }),
  entries: (opts) => exec("ENTRIES", {
    ...opts
  }),
  clear: (opts) => exec("CLEAR", {
    ...opts
  }),
  query: (fn, context, opts) => exec("QUERY", {
    fnStr: fn.toString(),
    context,
    ...opts
  }),
  getSome: (fn, context, opts) => exec("GET_SOME", {
    fnStr: fn.toString(),
    context,
    ...opts
  }),
  delSome: (fn, context, opts) => exec("DEL_SOME", {
    fnStr: fn.toString(),
    context,
    ...opts
  }),
  setSome: (selectFn, updateFn, context, opts) => exec("SET_SOME", {
    selectFnStr: selectFn.toString(),
    updateFnStr: updateFn.toString(),
    context,
    ...opts
  }),
  exportDB: (opts) => exec("EXPORT", {
    ...opts
  }),
  importDB: (data, clearFirst = false, opts) => exec("IMPORT", {
    data,
    clearFirst,
    ...opts
  }),
  backupToOpfs: (key, fileName, opts) => exec("BACKUP_OPFS", {
    key,
    fileName,
    ...opts
  }),
  restoreFromOpfs: (key, fileName, clearFirst = false, opts) => exec("RESTORE_OPFS", {
    key,
    fileName,
    clearFirst,
    ...opts
  }),
  init: (workerPath) => {
    getWorker(workerPath);
  },
  restart: () => restartWorker(),
  terminate: () => terminateWorker()
};
function createScopedDb(dbName, storeName = "keyval", prefix = "") {
  const opts = {
    dbName,
    storeName,
    prefix
  };
  return {
    get: (key) => globalDbAPI.get(key, opts),
    set: (keyOrVal, val) => globalDbAPI.set(keyOrVal, val, opts),
    update: (key, updater) => globalDbAPI.update(key, updater, opts),
    patch: (key, patchOrFn, context) => globalDbAPI.patch(key, patchOrFn, context, opts),
    delete: (key) => globalDbAPI.delete(key, opts),
    getMany: (keys) => globalDbAPI.getMany(keys, opts),
    setMany: (entries) => globalDbAPI.setMany(entries, opts),
    deleteMany: (keys) => globalDbAPI.deleteMany(keys, opts),
    keys: () => globalDbAPI.keys(opts),
    values: () => globalDbAPI.values(opts),
    entries: () => globalDbAPI.entries(opts),
    clear: () => globalDbAPI.clear(opts),
    query: (fn, context) => globalDbAPI.query(fn, context, opts),
    getSome: (fn, context) => globalDbAPI.getSome(fn, context, opts),
    delSome: (fn, context) => globalDbAPI.delSome(fn, context, opts),
    setSome: (selectFn, updateFn, context) => globalDbAPI.setSome(selectFn, updateFn, context, opts),
    exportDB: () => globalDbAPI.exportDB(opts),
    importDB: (data, clearFirst = false) => globalDbAPI.importDB(data, clearFirst, opts),
    backupToOpfs: (key, fileName) => globalDbAPI.backupToOpfs(key, fileName, opts),
    restoreFromOpfs: (key, fileName, clearFirst = false) => globalDbAPI.restoreFromOpfs(key, fileName, clearFirst, opts),
    gerarId,
    gerarIdComPrefixo: () => prefix ? gerarIdComPrefixo(prefix) : gerarId()
  };
}
var globalOpfsAPI = {
  ...globalDbAPI,
  listFiles: (key, opts) => exec("OPFS_LIST", {
    key,
    ...opts
  }),
  getFile: (key, fileName, opts) => exec("OPFS_GET", {
    key,
    fileName,
    ...opts
  }),
  addFile: (key, file, fileName, opts) => exec("OPFS_ADD", {
    key,
    file,
    fileName,
    ...opts
  }),
  delFile: (key, fileName, opts) => exec("OPFS_DEL", {
    key,
    fileName,
    ...opts
  }),
  renFile: (key, oldName, newName, opts) => exec("OPFS_REN", {
    key,
    oldName,
    newName,
    ...opts
  }),
  mvFile: (key, fileName, newKey, opts) => exec("OPFS_MV", {
    key,
    fileName,
    newKey,
    ...opts
  }),
  zip: (key, zipName, filesToZip, deleteOriginals = false, opts) => exec("OPFS_ZIP", {
    key,
    zipName,
    filesToZip,
    deleteOriginals,
    ...opts
  }),
  unzip: (key, zipName, deleteZip = false, opts) => exec("OPFS_UNZIP", {
    key,
    zipName,
    deleteZip,
    ...opts
  }),
  addZip: (key, zipName, file, fileName, opts) => exec("OPFS_ADDZIP", {
    key,
    zipName,
    file,
    fileName,
    ...opts
  }),
  delZip: (key, zipName, fileName, opts) => exec("OPFS_DELZIP", {
    key,
    zipName,
    fileName,
    ...opts
  })
};
function createScopedOpfs(dbName, storeName = "keyval", prefix = "", basePath = "") {
  const opts = {
    dbName,
    storeName,
    prefix,
    basePath
  };
  return {
    ...createScopedDb(dbName, storeName, prefix),
    listFiles: (key) => globalOpfsAPI.listFiles(key, opts),
    getFile: (key, fileName) => globalOpfsAPI.getFile(key, fileName, opts),
    addFile: (key, file, fileName) => globalOpfsAPI.addFile(key, file, fileName, opts),
    delFile: (key, fileName) => globalOpfsAPI.delFile(key, fileName, opts),
    renFile: (key, oldName, newName) => globalOpfsAPI.renFile(key, oldName, newName, opts),
    mvFile: (key, fileName, newKey) => globalOpfsAPI.mvFile(key, fileName, newKey, opts),
    zip: (key, zipName, filesToZip, deleteOriginals = false) => globalOpfsAPI.zip(key, zipName, filesToZip, deleteOriginals, opts),
    unzip: (key, zipName, deleteZip = false) => globalOpfsAPI.unzip(key, zipName, deleteZip, opts),
    addZip: (key, zipName, file, fileName) => globalOpfsAPI.addZip(key, zipName, file, fileName, opts),
    delZip: (key, zipName, fileName) => globalOpfsAPI.delZip(key, zipName, fileName, opts)
  };
}
var db = Object.assign((dbName, storeName, prefix) => createScopedDb(dbName, storeName, prefix), globalDbAPI);
var opfs = Object.assign((dbName, storeName, prefix, basePath = "") => createScopedOpfs(dbName, storeName, prefix, basePath), globalOpfsAPI);

// example/main.ts
var appElement = document.getElementById("app");
var logElement = document.getElementById("log-output");
function log(msg, data) {
  const dataStr = data ? `
  \u21B3 ${JSON.stringify(data, null, 2)}` : "";
  const fullText = `${msg}${dataStr}
`;
  if (logElement) {
    if (logElement.innerText.includes("Aguardando execu\xE7\xE3o")) {
      logElement.innerText = "";
    }
    logElement.innerText += fullText;
  }
  console.log(msg, data || "");
}
async function runRealWorldTests() {
  log("\u{1F680} INICIANDO DEMONSTRA\xC7\xC3O AVAN\xC7ADA DO LOCO PWA (AMBIENTE REAL)\n");
  ls().clear();
  db.init();
  log("\u{1F4E6} 1. LocalStorage - Escopos e Prefixos...");
  const prefStore = ls("LOCO_PREF_");
  prefStore.set({
    _id: "auto",
    theme: "dark",
    notificationsEnabled: true,
    activeChatId: "chat_1"
  });
  log(`   --> Total de chaves isoladas de Prefer\xEAncias: ${prefStore.keys().length}`);
  log("\n\u{1F4AC} 2. IndexedDB Worker - Populando Fila de Mensagens...");
  const msgStore = db("LOCO_DATA", "messages", "MSG_");
  await msgStore.clear();
  const now = Date.now();
  await msgStore.setMany([
    [
      "auto",
      {
        senderId: "alice",
        recipientId: "bob",
        content: "Oi!",
        status: "delivered",
        priority: 1,
        timestamp: now - 5e3
      }
    ],
    [
      "auto",
      {
        senderId: "alice",
        recipientId: "bob",
        content: "Tudo bem?",
        status: "pending",
        priority: 1,
        timestamp: now - 4e3
      }
    ]
  ]);
  log(`   --> Total de mensagens injetadas com UUIDs gerados com sucesso: ${(await msgStore.keys()).length}`);
  log("\n\u{1F4CA} 3. IndexedDB Worker - An\xE1lises e Agrega\xE7\xF5es Remotas (query)...");
  const stats = await msgStore.query((items) => ({
    totalPending: items.filter((i) => i.status === "pending").length
  }));
  log(`   --> Estat\xEDsticas processadas no Worker:`, stats);
  log("\n\u{1F4BE} 4. Origin Private File System (OPFS) - Backup via opfs() com basePath 'backup'...");
  const backupDrive = opfs("LOCO_DATA", "messages", "MSG_", "backup");
  const RECORD_BACKUP_KEY = "mensagens_app";
  const oldBackupFiles = await backupDrive.listFiles(RECORD_BACKUP_KEY);
  for (const f of oldBackupFiles) {
    await backupDrive.delFile(RECORD_BACKUP_KEY, f.name);
  }
  await backupDrive.backupToOpfs(RECORD_BACKUP_KEY, "mensagens_v1.json");
  const storedFiles = await backupDrive.listFiles(RECORD_BACKUP_KEY);
  log(`   --> Backups gerados com sucesso. Arquivos na record-key '${RECORD_BACKUP_KEY}':`, storedFiles.map((f) => f.name));
  log("\n\u{1F916} 5. Service Worker - Intera\xE7\xE3o em Background (db-sw.ts)...");
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js", {
        type: "module"
      });
      if (!navigator.serviceWorker.controller) {
        log(`   --> \u26A0\uFE0F O Service Worker foi instalado. Pressione F5 (recarregar) para que ele assuma o controle da p\xE1gina.`);
      } else {
        log(`   --> Service Worker ativo e controlando a p\xE1gina! Solicitando opera\xE7\xE3o remota...`);
        const runSwTask = () => new Promise((resolve, reject) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (e) => {
            if (e.data.success) resolve(e.data.payload);
            else reject(new Error(e.data.error));
          };
          navigator.serviceWorker.controller.postMessage({
            type: "RUN_SW_DEMO"
          }, [
            channel.port2
          ]);
        });
        const swResult = await runSwTask();
        log(`   --> \u2705 Resultado retornado pelo Service Worker:`, swResult);
      }
    } catch (err) {
      log(`   \u274C Falha ao registrar o Service Worker:`, err);
    }
  }
  const finalStoredFiles = await backupDrive.listFiles(RECORD_BACKUP_KEY);
  if (appElement && finalStoredFiles.length > 0) {
    const downloadContainer = document.createElement("div");
    downloadContainer.style.marginTop = "24px";
    downloadContainer.style.padding = "16px";
    downloadContainer.style.backgroundColor = "var(--md-sys-color-surface)";
    downloadContainer.style.borderRadius = "12px";
    let linksHTML = `<h3 style="margin-top: 0; color: var(--md-sys-color-primary);">\u{1F5C2}\uFE0F Backups OPFS Gerados via opfs()</h3>`;
    linksHTML += `<div style="display: flex; flex-direction: column; gap: 12px;">`;
    for (const f of finalStoredFiles) {
      linksHTML += `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #1a1c19; padding: 12px 16px; border-radius: 8px;">
        <span>\u{1F4C1} ${f.name} - ${(f.size / 1024).toFixed(1)} KB</span>
        <button id="dl_${f.name.replace(/\./g, "_")}" style="cursor: pointer; background: var(--md-sys-color-primary); color: #1a1c19; border: none; font-weight: bold; border-radius: 4px; padding: 6px 12px;">
          Baixar Backup
        </button>
      </div>`;
    }
    downloadContainer.innerHTML = linksHTML + `</div>`;
    appElement.appendChild(downloadContainer);
    setTimeout(() => {
      for (const f of finalStoredFiles) {
        const btn = document.getElementById(`dl_${f.name.replace(/\./g, "_")}`);
        if (btn) {
          btn.onclick = async () => {
            const fileBlob = await backupDrive.getFile(RECORD_BACKUP_KEY, f.name);
            const objectUrl = URL.createObjectURL(fileBlob);
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = f.name;
            a.click();
            URL.revokeObjectURL(objectUrl);
          };
        }
      }
    }, 100);
  }
  db.terminate();
  log("\n\u2705 Demonstra\xE7\xE3o Completa Finalizada!");
}
function setupInteractiveOpfsUI() {
  if (!appElement) return;
  const container = document.createElement("div");
  container.style.marginTop = "32px";
  container.style.padding = "24px";
  container.style.backgroundColor = "var(--md-sys-color-surface)";
  container.style.borderRadius = "12px";
  container.style.border = "1px solid var(--md-sys-color-primary)";
  const title = document.createElement("h2");
  title.style.color = "var(--md-sys-color-primary)";
  title.style.marginTop = "0";
  title.innerText = "\u{1F4C1} Gerenciador Interativo OPFS (Isolado)";
  const desc = document.createElement("p");
  desc.innerText = "Envie m\xFAltiplos arquivos para a pasta 'ui_uploads' utilizando o wrapper unificado opfs().";
  const inputWrapper = document.createElement("div");
  inputWrapper.style.marginBottom = "24px";
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.style.display = "block";
  input.style.padding = "8px 0";
  input.style.color = "var(--md-sys-color-on-background)";
  const fileListContainer = document.createElement("div");
  fileListContainer.style.display = "flex";
  fileListContainer.style.flexDirection = "column";
  fileListContainer.style.gap = "8px";
  inputWrapper.appendChild(input);
  container.appendChild(title);
  container.appendChild(desc);
  container.appendChild(inputWrapper);
  container.appendChild(fileListContainer);
  appElement.appendChild(container);
  const userDrive = opfs("INTERACTIVE_DB", "files", "INT_", "ui_uploads");
  const FOLDER_KEY = "pasta_do_usuario";
  userDrive.set(FOLDER_KEY, {
    created: Date.now(),
    type: "interactive_test"
  }).catch(console.error);
  const renderFiles = async () => {
    fileListContainer.innerHTML = "<p>Carregando arquivos...</p>";
    try {
      const files = await userDrive.listFiles(FOLDER_KEY);
      fileListContainer.innerHTML = "";
      if (files.length === 0) {
        fileListContainer.innerHTML = "<p style='color: #888;'>Nenhum arquivo nesta pasta. Fa\xE7a um upload acima!</p>";
        return;
      }
      for (const f of files) {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.background = "#1a1c19";
        item.style.padding = "12px 16px";
        item.style.borderRadius = "8px";
        const name = document.createElement("span");
        name.innerText = `${f.name} - ${(f.size / 1024).toFixed(1)} KB`;
        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "8px";
        const btnDownload = document.createElement("button");
        btnDownload.innerText = "Baixar";
        btnDownload.style.cursor = "pointer";
        btnDownload.style.background = "var(--md-sys-color-primary)";
        btnDownload.style.color = "#1a1c19";
        btnDownload.style.border = "none";
        btnDownload.style.fontWeight = "bold";
        btnDownload.style.borderRadius = "4px";
        btnDownload.style.padding = "6px 12px";
        btnDownload.onclick = async () => {
          try {
            const btnOriginalText = btnDownload.innerText;
            btnDownload.innerText = "Baixando...";
            btnDownload.disabled = true;
            const fileBlob = await userDrive.getFile(FOLDER_KEY, f.name);
            const url = URL.createObjectURL(fileBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = f.name;
            a.click();
            URL.revokeObjectURL(url);
            btnDownload.innerText = btnOriginalText;
            btnDownload.disabled = false;
          } catch (err) {
            console.error("Erro no download:", err);
            btnDownload.innerText = "Erro!";
          }
        };
        const btnDelete = document.createElement("button");
        btnDelete.innerText = "Excluir";
        btnDelete.style.cursor = "pointer";
        btnDelete.style.background = "#ff5252";
        btnDelete.style.color = "white";
        btnDelete.style.border = "none";
        btnDelete.style.fontWeight = "bold";
        btnDelete.style.borderRadius = "4px";
        btnDelete.style.padding = "6px 12px";
        btnDelete.onclick = async () => {
          btnDelete.disabled = true;
          btnDelete.innerText = "Excluindo...";
          await userDrive.delFile(FOLDER_KEY, f.name);
          await renderFiles();
        };
        actions.appendChild(btnDownload);
        actions.appendChild(btnDelete);
        item.appendChild(name);
        item.appendChild(actions);
        fileListContainer.appendChild(item);
      }
    } catch (err) {
      fileListContainer.innerHTML = `<p style="color: #ff5252;">Erro ao listar: ${err.message}</p>`;
    }
  };
  input.onchange = async () => {
    if (!input.files || input.files.length === 0) return;
    input.disabled = true;
    try {
      for (const file of Array.from(input.files)) {
        await userDrive.addFile(FOLDER_KEY, file, file.name);
      }
    } catch (err) {
      console.error("Erro ao subir arquivo:", err);
    } finally {
      input.disabled = false;
      input.value = "";
      await renderFiles();
    }
  };
  renderFiles();
}
runRealWorldTests().then(() => setupInteractiveOpfsUI()).catch((err) => {
  log("\u274C OCORREU UM ERRO FATAL:", err.message);
});
//# sourceMappingURL=index-LWWXGTKI.js.map
