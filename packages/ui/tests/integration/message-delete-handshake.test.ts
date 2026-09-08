// Arquivo: monorepo/ui/tests/integration/message-delete-handshake.test.ts
/// <reference lib="deno.ns" />
import "fake-indexeddb/auto";
import { assertEquals, assertExists } from "@std/assert";
import { excluirMensagem } from "../../src/stores/mensagensStore.ts";
import { Processar as ProcessarMensagem } from "@loco/service-worker/handshakes/mensagem";
import { salvarChat, buscarChat, salvarHandshake, buscarHandshake, listarHandshakes, salvarContato, removerHandshake } from "@loco/utils/db";
import type { Chat, Handshake, Contato } from "@loco/utils/interfaces";

Deno.test("INTEGRAÇÃO (Exclusão - Parte 1): Apagar mensagem local deve gerar Handshake de exclusão remota OUT", async () => {
  const contatoHash = "hash-contato-bob-123";
  const msgId = "msg-para-deletar-456";
  
  const msg: Chat = { id: msgId, contatoHash, conteudo: "Mensagem que será apagada bidirecionalmente", tipo: "out", createdAt: Date.now(), handshake: "handshake-original-envio" };
  await salvarChat(msg);
  assertExists(await buscarChat(msgId));

  let mensagemSWCapturada: any = null;
  if (typeof navigator !== "undefined") {
    (navigator as any).serviceWorker = { ready: Promise.resolve({ active: { postMessage: (data: any) => { mensagemSWCapturada = data; } } }) };
  }

  await excluirMensagem(msgId, contatoHash);
  const msgNoDb = await buscarChat(msgId);
  assertEquals(msgNoDb, undefined);

  assertExists(mensagemSWCapturada);
  assertEquals(mensagemSWCapturada.type, "CRIAR_HANDSHAKE_OUT");
  assertEquals(mensagemSWCapturada.payload.rotasModulo, "mensagem");
  assertEquals(mensagemSWCapturada.payload.params.function, "excluirMensagem");
  assertEquals(mensagemSWCapturada.payload.params.msgId, msgId);

  await ProcessarMensagem({ out: mensagemSWCapturada.payload.params });
  const handshakes = await listarHandshakes();
  const handshakeExclusao = handshakes.find(h => h.aud === contatoHash && h.out?.rotas.mensagem?.excluida === msgId);
  assertExists(handshakeExclusao);
  assertEquals(handshakeExclusao.out?.status, "pendente");

  for (const h of handshakes) await removerHandshake(h.id);
});

Deno.test("INTEGRAÇÃO (Exclusão - Parte 2): Receber Handshake de exclusão remota IN deve apagar a mensagem do IndexedDB", async () => {
  const contatoHash = "hash-contato-alice-789";
  const msgIdRecebida = "msg-recebida-alice-101";
  const handshakeInId = "handshake-in-exclusao-999";

  const contato: Contato = {
    id: contatoHash, name: "Alice", email: "alice@loco.pwa",
    vapidPublicKey: {} as any, e2ePublicKey: {} as any,
    subscription: { endpoint: "ep", keys: { p256dh: "p", auth: "a" }, proxyserver: "ps" },
    vapidPrivateKeyEnvelope: "env", trusted: true, me: "saved", createdAt: Date.now(), updatedAt: Date.now()
  };
  await salvarContato(contato);

  const msgRecebida: Chat = { id: msgIdRecebida, contatoHash, conteudo: "Mensagem que a Alice decidiu apagar remotamente", tipo: "in", createdAt: Date.now(), handshake: "handshake-original-recebimento" };
  await salvarChat(msgRecebida);
  assertExists(await buscarChat(msgIdRecebida));

  const handshakeIn: Handshake = {
    id: handshakeInId, aud: contatoHash, createdAt: Date.now(), updatedAt: Date.now(),
    in: { status: "recebido", tentativas: 0, rotas: { mensagem: { excluida: msgIdRecebida } } }
  };
  await salvarHandshake(handshakeIn);

  await ProcessarMensagem({ in: handshakeInId });
  const msgAposProcessar = await buscarChat(msgIdRecebida);
  assertEquals(msgAposProcessar, undefined);

  await removerHandshake(handshakeInId);
});