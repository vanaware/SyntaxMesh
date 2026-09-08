// Arquivo: monorepo/ui/tests/integration/contact-purge.test.ts
/// <reference lib="deno.ns" />
import "fake-indexeddb/auto";
import { assertEquals, assertExists } from "@std/assert";
import { removerContatoCompletamente, contatosRaw } from "../../src/stores/contatosStore.ts";
import { 
  salvarContato, salvarChat, salvarHandshake, buscarContatoPorChave, buscarChat, 
  buscarHandshake, serializarPublicKeyVapid, listarChatPaginado, listarHandshakes 
} from "@loco/utils/db";
import { generateVAPIDKeys, generateE2EEKeys, exportKeyToJWK } from "@loco/utils/crypto";
import type { Contato, Chat, Handshake } from "@loco/utils/interfaces";

Deno.test("INTEGRAÇÃO E EXPURGO: Excluir contato deve aplicar Tombstone e apagar histórico antigo em cascata", async () => {
  const vapidKeys = await generateVAPIDKeys();
  const e2eKeys = await generateE2EEKeys();
  const pubVapidJwk = await exportKeyToJWK(vapidKeys.publicKey);
  const contatoHash = await serializarPublicKeyVapid(pubVapidJwk);
  
  const novoContato: Contato = {
    id: contatoHash, name: "Contato Para Exclusão", email: "expurgo@loco.pwa",
    vapidPublicKey: pubVapidJwk, e2ePublicKey: e2eKeys.publicEncrypt,
    subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/token-expurgo", keys: { p256dh: "p256dh", auth: "auth" }, proxyserver: "https://proxy.loco.com" },
    vapidPrivateKeyEnvelope: "envelope-cifrado", trusted: true, me: "saved",
    createdAt: Date.now(), updatedAt: Date.now()
  };
  await salvarContato(novoContato);
  contatosRaw.value = [novoContato];

  const msg1: Chat = { id: "msg-expurgo-1", contatoHash, conteudo: "Mensagem enviada 1", tipo: "out", createdAt: Date.now(), handshake: "handshake-msg-1" };
  const msg2: Chat = { id: "msg-expurgo-2", contatoHash, conteudo: "Mensagem recebida 2", tipo: "in", createdAt: Date.now() + 100, handshake: "handshake-msg-2" };
  await salvarChat(msg1); await salvarChat(msg2);

  const handContato: Handshake = { id: "handshake-contato-id", aud: contatoHash, createdAt: Date.now(), updatedAt: Date.now(), out: { status: "enviado", tentativas: 1, rotas: { contato: { id: contatoHash } } } };
  const handProfile: Handshake = { id: "handshake-profile-id", aud: contatoHash, createdAt: Date.now(), updatedAt: Date.now(), out: { status: "enviado", tentativas: 1, rotas: { profile: { campos: ["name"] } } } };
  const handMensagem: Handshake = { id: "handshake-msg-1", aud: contatoHash, createdAt: Date.now(), updatedAt: Date.now(), out: { status: "enviado", tentativas: 1, rotas: { mensagem: { enviada: "msg-expurgo-1" } } } };
  await salvarHandshake(handContato); await salvarHandshake(handProfile); await salvarHandshake(handMensagem);

  assertExists(await buscarContatoPorChave(contatoHash));
  assertExists(await buscarChat("msg-expurgo-1"));

  await removerContatoCompletamente(contatoHash);

  const contatoNoDb = await buscarContatoPorChave(contatoHash);
  assertExists(contatoNoDb);
  assertEquals(contatoNoDb.me, "deleted");
  assertEquals(contatosRaw.value.some(c => c.id === contatoHash), false);

  assertEquals(await buscarChat("msg-expurgo-1"), undefined);
  assertEquals(await buscarChat("msg-expurgo-2"), undefined);
  assertEquals((await listarChatPaginado(contatoHash, 30, 0)).length, 0);

  assertEquals(await buscarHandshake("handshake-contato-id"), undefined);
  assertEquals(await buscarHandshake("handshake-profile-id"), undefined);
  assertEquals(await buscarHandshake("handshake-msg-1"), undefined);

  const allHandshakes = await listarHandshakes();
  const handshakeDelecao = allHandshakes.find(h => h.aud === contatoHash && h.out?.rotas?.contato?.removerContato === true);
  assertExists(handshakeDelecao);
});