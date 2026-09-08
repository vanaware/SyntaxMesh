// Arquivo: monorepo/ui/tests/stores/mensagensStore.test.ts
/// <reference lib="deno.ns" />
import "fake-indexeddb/auto";
import { assertEquals, assert } from "@std/assert";
import { mensagensAtivas, inicializarChat, atualizarOuAdicionarChatAtivo } from "../../src/stores/mensagensStore.ts";
import { removerTodoHistoricoChat, buscarChat } from "@loco/utils/db";
import { contatoSelecionado } from "../../src/stores/state.ts";
import type { Chat } from "@loco/utils/interfaces";

Deno.test("Store: Mensagens - Deve refletir atualizações no Signal de forma Otimista", async () => {
  const hashContato = "contato-reativo-123";
  await removerTodoHistoricoChat(hashContato);
  
  contatoSelecionado.value = hashContato;
  await inicializarChat(hashContato);
  assertEquals(mensagensAtivas.value.length, 0);
  
  const novaMsg: Chat = { id: "msg-signal-01", contatoHash: hashContato, conteudo: "Teste de Reatividade com Signals!", tipo: 'out', createdAt: Date.now(), handshake: "hand-01" };
  await atualizarOuAdicionarChatAtivo(novaMsg);
  
  assertEquals(mensagensAtivas.value.length, 1);
  assertEquals(mensagensAtivas.value[0]!.conteudo, "Teste de Reatividade com Signals!");
  
  const msgNoBanco = await buscarChat("msg-signal-01");
  assert(msgNoBanco !== undefined);
  assertEquals(msgNoBanco.conteudo, "Teste de Reatividade com Signals!");
});

Deno.test("Store: Mensagens - Não deve sujar o Signal se o chat ativo for diferente", async () => {
  const hashContatoAtivo = "contato-A";
  const hashOutroContato = "contato-B";
  
  contatoSelecionado.value = hashContatoAtivo;
  await inicializarChat(hashContatoAtivo);
  
  const msgParaOutro: Chat = { id: "msg-signal-02", contatoHash: hashOutroContato, conteudo: "Isso não deve aparecer na tela A", tipo: 'in', createdAt: Date.now(), handshake: "hand-02" };
  await atualizarOuAdicionarChatAtivo(msgParaOutro);
  
  assertEquals(mensagensAtivas.value.length, 0);
});