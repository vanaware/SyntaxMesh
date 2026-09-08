// src/utils/push-utils.ts
import { gzipSync } from "fflate";
import { addDebugLog } from "../debug/mod.ts";
import { 
  minifyVapidPrivate, 
  minifyVapidPublic, 
  expandVapidPublic, 
  expandVapidPrivate 
} from "../crypto/mod.ts";
import { fetchLocoProxy } from "../config/proxy.ts";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    return btoa(binary);
  } catch (e: any) {
    throw new Error(`Erro ao encodar payload cifrado para Base64: ${e.message}`);
  }
}

export async function cifrarPayloadObj(payloadObj: any, publicKeyRSA: JsonWebKey): Promise<{
  i: string;
  d: string;
  k: string;
}> {
  try {
    const encoder = new TextEncoder();
    const jsonString = JSON.stringify(payloadObj);
    const bytes = encoder.encode(jsonString);
    
    const compressed = gzipSync(bytes);
    
    addDebugLog("info", "CRYPTO:PUSH", `Comprimido: ${compressed.length} bytes (Original: ${bytes.length} bytes)`);
    if (compressed.length > 3000) {
       addDebugLog("warn", "CRYPTO:PUSH", `Atenção: O payload comprimido está em ${compressed.length} bytes. Risco de estourar o limite de 4KB após a assinatura JWT.`);
    }

    const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      compressed as unknown as BufferSource
    );

    const cryptoKeyDestino = await crypto.subtle.importKey(
      "jwk" as any,
      publicKeyRSA,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );
    
    const aesKeyRaw = await crypto.subtle.exportKey("raw", aesKey);
    const aesKeyEncrypted = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      cryptoKeyDestino,
      aesKeyRaw
    );

    return {
      i: arrayBufferToBase64(iv.buffer as ArrayBuffer),
      d: arrayBufferToBase64(encryptedBuffer),
      k: arrayBufferToBase64(aesKeyEncrypted)
    };
  } catch (err: any) {
    addDebugLog("error", "CRYPTO:PUSH", `Erro severo na montagem do envelope E2EE: ${err.message}`);
    throw new Error(`Falha de criptografia Híbrida: ${err.message}`);
  }
}

export async function enviarParaProxy(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string }; proxyserver?: string },
  payloadText: string,
  vapid: { subject: string; publicKey: JsonWebKey; privateKey: string }
): Promise<void> {
  const payloadSize = new Blob([payloadText]).size;
  if (payloadSize > 4096) {
    addDebugLog("error", "NETWORK:PUSH", `Rejeição preventiva: Payload de ${payloadSize} bytes ultrapassa o limite arquitetural de 4096 bytes do FCM.`);
    throw new Error(`Limite de cota de rede excedido. O pacote final ficou com ${payloadSize} bytes.`);
  }

  try {
    const response = await fetchLocoProxy('/push', {
      body: {
        subscription,
        payloadText,
        vapid: {
          subject: vapid.subject,
          publicKey: minifyVapidPublic(vapid.publicKey),
          privateKey: vapid.privateKey
        }
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`O servidor retransmissor rejeitou o pacote. HTTP ${response.status}: ${errorText}`);
    }
  } catch (err: any) {
     addDebugLog("error", "NETWORK:PUSH", `Falha de conexão com o Proxy: ${err.message}`);
     throw err;
  }
}

export async function cifrarChaveVapid(privateKeyJwk: JsonWebKey, serverPublicKeyJwk: JsonWebKey): Promise<string> {
  try {
    const serverKey = await crypto.subtle.importKey(
      "jwk" as any,
      serverPublicKeyJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );
    
    const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt"]
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    
    const minifiedPrivate = minifyVapidPrivate(privateKeyJwk);
    const vapidBytes = encoder.encode(JSON.stringify(minifiedPrivate));
    
    const vapidCifrado = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      vapidBytes as unknown as BufferSource
    );
    
    const aesKeyRaw = await crypto.subtle.exportKey("raw", aesKey);
    const aesKeyCifrado = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      serverKey,
      aesKeyRaw
    );

    const toHex = (buf: ArrayBuffer) =>
      Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const envelope = {
      iv: toHex(iv.buffer as ArrayBuffer),
      dadosCifrados: toHex(vapidCifrado),
      chaveAesCifrada: toHex(aesKeyCifrado)
    };
    
    return btoa(JSON.stringify(envelope));
  } catch (err: any) {
    addDebugLog("error", "CRYPTO:VAPID", `Falha no envelopamento: ${err.message}`);
    throw new Error(`Erro ao blindar perfil para a rede: ${err.message}`);
  }
}

export async function decifrarChaveVapid(base64Envelope: string, serverPrivateKey: CryptoKey): Promise<any> {
  try {
    let binaryString: string;
    try {
      binaryString = atob(base64Envelope);
    } catch (_e) {
      const base64Standard = base64Envelope.replace(/-/g, "+").replace(/_/g, "/");
      binaryString = atob(base64Standard);
    }

    const { iv, dadosCifrados, chaveAesCifrada } = JSON.parse(binaryString);

    const fromHex = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const ivBytes = fromHex(iv);
    const dadosBytes = fromHex(dadosCifrados);
    const chaveAesCifradaBytes = fromHex(chaveAesCifrada);

    const aesChaveCruaBuffer = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" }, 
      serverPrivateKey, 
      chaveAesCifradaBytes
    );
    
    const chaveSimetricaAes = await crypto.subtle.importKey(
      "raw", 
      aesChaveCruaBuffer, 
      { name: "AES-GCM", length: 256 }, 
      false, 
      ["decrypt"]
    );
    
    const vapidOriginalBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes }, 
      chaveSimetricaAes, 
      dadosBytes
    );

    return JSON.parse(new TextDecoder().decode(vapidOriginalBuffer));
  } catch (err: any) {
    addDebugLog("error", "CRYPTO:VAPID", `Falha no deciframento do envelope: ${err.message}`);
    throw err;
  }
}

/**
 * Decifra a chave privada VAPID contida no envelope via chave RSA do Servidor e
 * reidrata/expande ambos os JWKs (Público e Privado) para o formato padrão do WebCrypto.
 */
export async function extrairEExpandirChavesVapid(
  serverPrivateKey: CryptoKey,
  publicKeyRaw: any,
  privateKeyEnvelopeBase64: string
): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey }> {
  try {
    const privateKeyUnwrapped = await decifrarChaveVapid(privateKeyEnvelopeBase64, serverPrivateKey);
    
    const pub = typeof publicKeyRaw === "string" ? JSON.parse(publicKeyRaw) : publicKeyRaw;
    const priv = typeof privateKeyUnwrapped === "string" ? JSON.parse(privateKeyUnwrapped) : privateKeyUnwrapped;

    const expandedPub = expandVapidPublic(pub);
    const expandedPriv = expandVapidPrivate(priv, expandedPub);

    return { publicKey: expandedPub, privateKey: expandedPriv };
  } catch (err: any) {
    throw new Error(`JWK/Envelope VAPID inválido: ${err.message}`);
  }
}