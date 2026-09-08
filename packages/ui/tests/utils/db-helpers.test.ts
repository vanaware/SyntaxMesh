// Arquivo: monorepo/ui/tests/utils/db-helpers.test.ts
/// <reference lib="deno.ns" />
import "fake-indexeddb/auto";
import { assertEquals, assertExists } from "@std/assert";
import { salvarProfile, buscarProfile, removerProfile, salvarChat, listarChatPaginado, removerTodoHistoricoChat } from "@loco/utils/db";
import type { ProfileConfig, Chat } from "@loco/utils/interfaces";

Deno.test("DB Helpers - Profile: Deve salvar, buscar e remover o perfil corretamente", async () => {
  const mockProfile: ProfileConfig = {
    name: "Arquiteto Loco", email: "arq@loco.pwa",
    vapidPublicKey: { kty: "EC", crv: "P-256", x: "123", y: "456" } as JsonWebKey,
    vapidPrivateKeyJwk: { kty: "EC", d: "789" } as JsonWebKey,
    vapidPrivateKeyEnvelope: "envelope_cifrado",
    e2ePublicKey: { kty: "RSA", n: "abc", e: "AQAB" } as JsonWebKey,
    e2ePrivateKeyJwk: { kty: "RSA", d: "def" } as JsonWebKey,
    subscription: { endpoint: "https://push.com/123", keys: { p256dh: "p256", auth: "auth" }, proxyserver: "https://loco.proxy" },
    createdAt: Date.now(), updatedAt: Date.now()
  };
  
  await salvarProfile(mockProfile);
  const profileSalvo = await buscarProfile();
  assertExists(profileSalvo);
  assertEquals(profileSalvo.name, "Arquiteto Loco");
  assertEquals(profileSalvo.vapidPublicKey.kty, "EC");
  
  await removerProfile();
  const profileRemovido = await buscarProfile();
  assertEquals(profileRemovido, undefined);
});

Deno.test("DB Helpers - Chat: Deve salvar mensagens e retornar paginado corretamente", async () => {
  const contatoHash = "hash-contato-paginacao-123";
  await removerTodoHistoricoChat(contatoHash);
  
  const totalMensagens = 35;
  for (let i = 1; i <= totalMensagens; i++) {
    const msg: Chat = { id: `msg-${i.toString().padStart(2, '0')}`, contatoHash, conteudo: `Mensagem de teste número ${i}`, tipo: 'out', createdAt: 10000 + i, handshake: `hand-${i}` };
    await salvarChat(msg);
  }
  
  const pagina1 = await listarChatPaginado(contatoHash, 30, 0);
  assertEquals(pagina1.length, 30);
  assertEquals(pagina1[pagina1.length - 1]!.id, "msg-35");
  assertEquals(pagina1[0]!.id, "msg-06");
  
  const pagina2 = await listarChatPaginado(contatoHash, 30, 30);
  assertEquals(pagina2.length, 5);
  
  const paginaVazia = await listarChatPaginado(contatoHash, 30, 35);
  assertEquals(paginaVazia.length, 0);
  
  await removerTodoHistoricoChat(contatoHash);
  const paginaPosExclusao = await listarChatPaginado(contatoHash, 30, 0);
  assertEquals(paginaPosExclusao.length, 0);
});