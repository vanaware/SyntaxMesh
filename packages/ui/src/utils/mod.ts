// Arquivo: monorepo/ui/src/utils/profile.ts
import { salvarProfile, buscarProfile } from '@loco/utils/db';
import { cifrarChaveVapid } from '@loco/utils/proxy';
import { registrarServiceWorker } from "@loco/service-worker/utils";
import { generateE2EEKeys, generateVAPIDKeys, rawBufferToBase64Url, expandRsaPublic } from '@loco/utils/crypto';
import type { ProfileConfig } from '@loco/utils/interfaces';
import { addDebugLog } from '@loco/utils/debug';
import { fetchLocoProxy } from '@loco/utils/config';
import { getConfigValue, saveConfig } from '../stores/config-store.ts';

export async function getServerPublicKey(): Promise<JsonWebKey>  {
  try {
    const cachedKey = await getConfigValue('SERVER_PUBLIC_KEY');
    if (cachedKey) {
      addDebugLog("info", "CRYPTO", "Chave do servidor carregada instantaneamente do cache local.");
      return expandRsaPublic(JSON.parse(cachedKey));
    }
  } catch (e) {
    addDebugLog("warn", "CRYPTO", "Falha ao ler cache da chave do servidor. Recarregando da rede...", e);
  }

  addDebugLog("info", "NETWORK", "Buscando chave pública do servidor na rede...");
  const response = await fetchLocoProxy('/publickey');
  if (!response.ok) throw new Error(`Erro ao buscar chave do servidor: ${response.status}`);
  const keyData = await response.json();
  await saveConfig('SERVER_PUBLIC_KEY', JSON.stringify(keyData));
  return expandRsaPublic(keyData);
}

export async function solicitarArmazenamentoPersistente(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    try {
      const concedido = await navigator.storage.persist();
      if (concedido) {
        addDebugLog("✅ Armazenamento Persistente concedido pelo navegador.");
      } else {
        addDebugLog("ℹ️ Navegador manteve o Armazenamento Padrão.");
      }
      return concedido;
      // deno-lint-ignore no-explicit-any
    } catch (err: any) {
      addDebugLog("⚠️ Erro ao solicitar armazenamento persistente: " + err.message);
      return false;
    }
  }
  return false;
}

export async function repararSubscricaoPush(): Promise<boolean> {
  addDebugLog("info", "PROFILE", "Iniciando rotina de reparo da Subscrição Push...");
  try {
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Permissão de notificação negada pelo usuário.");
    }
    
    const registration = await registrarServiceWorker();
    if (!registration.pushManager) throw new Error("Push API não suportada pelo navegador.");
    
    const p = await buscarProfile();
    if (!p) throw new Error("Perfil local não encontrado. Crie um perfil primeiro.");
    
    let sub = await registration.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
    }
    
    const rawPublicKey = await globalThis.crypto.subtle.exportKey("raw", await globalThis.crypto.subtle.importKey("jwk", p.vapidPublicKey, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]));
    sub = await registration.pushManager.subscribe({
      applicationServerKey: new Uint8Array(rawPublicKey),
      userVisibleOnly: true
    });
    
    const p256dhBuffer = sub.getKey('p256dh');
    const authBuffer = sub.getKey('auth');
    if (!p256dhBuffer || !authBuffer) throw new Error("Falha ao extrair chaves da subscrição gerada.");
    
    p.subscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: rawBufferToBase64Url(p256dhBuffer),
        auth: rawBufferToBase64Url(authBuffer)
      },
      proxyserver: p.subscription?.proxyserver || '/'
    };
    p.updatedAt = Date.now();
    
    const { atualizarProfile } = await import('../stores/profileStore.ts');
    await atualizarProfile(p);
    
    addDebugLog("success", "PROFILE", "Subscrição Push reparada com sucesso!");
    return true;
    // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    addDebugLog("error", "PROFILE", `Falha ao reparar Push: ${err.message}`);
    return false;
  }
}

export async function gerarProfileCompleto(nome: string, email: string = ""): Promise<ProfileConfig> {
  addDebugLog("📦 Gerando/Atualizando perfil unificado...");
  if (!nome || nome.trim() === "") {
    throw new Error("Preencha pelo menos o seu Nome.");
  }
  
  let vapidKeyPair: CryptoKeyPair | undefined = undefined;
  let publicKeyJwk: JsonWebKey | undefined = undefined;
  let privateKeyJwk: JsonWebKey | undefined = undefined;
  let e2ePublicKey: JsonWebKey | undefined = undefined;
  let e2ePrivateKeyJwk: JsonWebKey | undefined = undefined;
  
  const existingProfile = await buscarProfile();
  
  let finalSubscription: ProfileConfig['subscription'] = existingProfile?.subscription || {
    endpoint: '',
    keys: { p256dh: '', auth: '' },
    proxyserver: '/'
  };
  
  try {
    addDebugLog("Step 1: Registrando Service Worker...");
    const registration = await registrarServiceWorker();
    
    addDebugLog("Step 2: Buscando chave pública do servidor...");
    const serverPublicKeyJwk = await getServerPublicKey();
    
    if (existingProfile && existingProfile.vapidPublicKey && existingProfile.vapidPrivateKeyJwk) {
      publicKeyJwk = existingProfile.vapidPublicKey;
      privateKeyJwk = existingProfile.vapidPrivateKeyJwk;
    } else {
      addDebugLog("🔑 Gerando novas chaves VAPID...");
      vapidKeyPair = await generateVAPIDKeys();
      publicKeyJwk = await globalThis.crypto.subtle.exportKey("jwk", vapidKeyPair.publicKey);
      privateKeyJwk = await globalThis.crypto.subtle.exportKey("jwk", vapidKeyPair.privateKey);
    }
    
    if (existingProfile && existingProfile.e2ePublicKey && existingProfile.e2ePrivateKeyJwk) {
      e2ePublicKey = existingProfile.e2ePublicKey;
      e2ePrivateKeyJwk = existingProfile.e2ePrivateKeyJwk;
    } else {
      addDebugLog("🔑 Gerando novas chaves E2E...");
      const newKeys = await generateE2EEKeys();
      e2ePublicKey = newKeys.publicEncrypt;
      e2ePrivateKeyJwk = newKeys.privateDecryptJwk;
    }
    
    addDebugLog("Step 3: Tentando obter subscription Push...");
    try {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission === 'granted' && registration.pushManager) {
        let existingSubscription = await registration.pushManager.getSubscription();
        let subscriptionValida = false;
        
        if (existingSubscription) {
          if (existingProfile?.subscription && existingProfile.subscription.endpoint === existingSubscription.endpoint) {
            subscriptionValida = true;
          } else {
            await existingSubscription.unsubscribe();
            existingSubscription = null;
          }
        }
        
        if (!existingSubscription || !subscriptionValida) {
          if (!publicKeyJwk) throw new Error("Chave VAPID pública ausente.");
          const rawPublicKey = await globalThis.crypto.subtle.exportKey("raw", await globalThis.crypto.subtle.importKey("jwk", publicKeyJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]));
          existingSubscription = await registration.pushManager.subscribe({
            applicationServerKey: new Uint8Array(rawPublicKey),
            userVisibleOnly: true
          });
        }
        
        const p256dhBuffer = existingSubscription.getKey('p256dh');
        const authBuffer = existingSubscription.getKey('auth');
        
        if (p256dhBuffer && authBuffer) {
          finalSubscription = {
            endpoint: existingSubscription.endpoint,
            keys: { p256dh: rawBufferToBase64Url(p256dhBuffer), auth: rawBufferToBase64Url(authBuffer) },
            proxyserver: existingProfile?.subscription?.proxyserver || '/'
          };
        }
      } else {
        throw new Error("Permissão de Push negada ou API indisponível no navegador.");
      }
      // deno-lint-ignore no-explicit-any
    } catch (subErr: any) {
      addDebugLog("warn", "PROFILE", "Falha na subscrição Push. Salvando perfil offline-only.", subErr);
    }
    
    if (!privateKeyJwk || !publicKeyJwk || !e2ePrivateKeyJwk || !e2ePublicKey) {
      throw new Error("Falha interna: Chaves criptográficas corrompidas ou não geradas.");
    }
    
    const privateKeyEncrypted = await cifrarChaveVapid(privateKeyJwk, serverPublicKeyJwk);
    
    const profile: ProfileConfig = {
      name: nome.trim(),
      email: email.trim(),
      vapidPublicKey: publicKeyJwk,
      vapidPrivateKeyJwk: privateKeyJwk,
      vapidPrivateKeyEnvelope: privateKeyEncrypted,
      e2ePublicKey: e2ePublicKey,
      e2ePrivateKeyJwk: e2ePrivateKeyJwk,
      subscription: finalSubscription,
      createdAt: existingProfile?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    
    await salvarProfile(profile);
    await solicitarArmazenamentoPersistente();
    addDebugLog("✅ Perfil gerado/atualizado e persistido com sucesso.");
    return profile;
  } catch (err) {
    addDebugLog("error", "PROFILE", "Erro fatal ao gerar perfil: " + (err instanceof Error ? err.message : String(err)));
    throw err;
  }
}