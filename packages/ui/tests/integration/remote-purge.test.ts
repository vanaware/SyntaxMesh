// Arquivo: monorepo/ui/tests/integration/remote-purge.test.ts
/// <reference lib="deno.ns" />
import "fake-indexeddb/auto";
import { assertEquals, assertExists } from "@std/assert";
import { limparTodoHistorico } from "../../src/stores/mensagensStore.ts";
import { removerContatoCompletamente } from "../../src/stores/contatosStore.ts";
import { Processar as ProcessarMensagem } from "@loco/service-worker/handshakes/mensagem";
import { Processar as ProcessarContato } from "@loco/service-worker/handshakes/contato";
import { salvarChat, buscarChat, salvarContato, buscarContatoPorChave, salvarHandshake, listarHandshakes, removerHandshake, serializarPublicKeyVapid } from "@loco/utils/db";
import { generateVAPIDKeys, generateE2EEKeys, exportKeyToJWK } from "@loco/utils/crypto";
import type { Contato, Handshake } from "@loco/utils/interfaces";

Deno.test("INTEGRAÇÃO (Expurgo Remoto 1): Limpar histórico cria Handshake Único e Apaga no Remoto", async () => {
  const contatoHash = "hash-bob-purge";
  await salvarChat({ id: "m1", contatoHash, conteudo: "1", tipo: "out", createdAt: Date.now(), handshake: "h1" });
  await salvarChat({ id: "m2", contatoHash, conteudo: "2", tipo: "in", createdAt: Date.now(), handshake: "h2" });
  
  await limparTodoHistorico(contatoHash);
  
  const handshakes = await listarHandshakes();
  const handPurge = handshakes.find(h => h.aud === contatoHash && h.out?.rotas.mensagem?.limparHistorico === true);
  assertExists(handPurge);
  
  const handIn: Handshake = { id: "hand-in-purge", aud: contatoHash, createdAt: Date.now(), updatedAt: Date.now(), in: { status: "recebido", tentativas: 0, rotas: { mensagem: { limparHistorico: true } } } };
  await salvarHandshake(handIn);
  await ProcessarMensagem({ in: "hand-in-purge" });
  
  assertEquals(await buscarChat("m1"), undefined);
  assertEquals(await buscarChat("m2"), undefined);
  
  for (const h of await listarHandshakes()) await removerHandshake(h.id);
});

Deno.test("INTEGRAÇÃO (Expurgo Remoto 2): Excluir Contato cria Handshake Único de Remoção de Perfil no Remoto", async () => {
  const vapidKeys = await generateVAPIDKeys();
  const pubVapid = await exportKeyToJWK(vapidKeys.publicKey);
  const contatoHash = await serializarPublicKeyVapid(pubVapid);
  
  const contato: Contato = {
    id: contatoHash, name: "Alice", email: "a@a.com",
    vapidPublicKey: pubVapid, e2ePublicKey: {} as any,
    subscription: { endpoint: "e", keys: { p256dh: "p", auth: "a" }, proxyserver: "ps" },
    vapidPrivateKeyEnvelope: "e", trusted: true, me: "saved", createdAt: Date.now(), updatedAt: Date.now()
  };
  await salvarContato(contato);
  
  await removerContatoCompletamente(contatoHash, true);
  
  const handshakes = await listarHandshakes();
  const handDelete = handshakes.find(h => h.aud === contatoHash && h.out?.rotas.contato?.removerContato === true);
  assertExists(handDelete);
  
  const handIn: Handshake = { id: "hand-in-del-contact", aud: contatoHash, createdAt: Date.now(), updatedAt: Date.now(), in: { status: "recebido", tentativas: 0, rotas: { contato: { removerContato: true } } } };
  await salvarHandshake(handIn);
  await ProcessarContato({ in: "hand-in-del-contact" });
  
  assertEquals(await buscarContatoPorChave(contatoHash), undefined);
  
  for (const h of await listarHandshakes()) await removerHandshake(h.id);
});