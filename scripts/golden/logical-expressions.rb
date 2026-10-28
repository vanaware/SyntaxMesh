#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# logical-expressions.rb — golden de expressões lógicas (Fase 11.13).
#
# Oracle: constrói árvores `LogicalOperation` puramente sobre primitivos
# (números, strings, booleanos) e avalia via `LogicalExpression#eval(nil)`.
# Como não há folhas `LogicalAttribute`/`LogicalFlag`/`LogicalFunction`, o
# contexto `query` não é tocado — o resultado é determinístico e portável.
#
# Escopo: só casos em que a semântica Ruby e a do port TS COINCIDEM
# (comparações de mesmo tipo, operadores lógicos lazy, `~`, sem precedência e
# erros). Comparações número-vs-string são propositalmente OMITIDAS: o Ruby é
# estrito (coerceNumber não aceita String) enquanto o port TS segue a tarefa
# 11.1.3.8 (parseFloat). Registrar isso no golden geraria falsa divergência.
#
# Serializa { description, tree, expected } para logical-expressions.golden.json.
# `expected` é true/false ou a string "error" (expr.error/TjException).
#
# @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb

$LOAD_PATH.unshift(File.expand_path("../../docs/taskjuggler/lib", __dir__))
require "json"
require "taskjuggler/LogicalExpression"

LO = TaskJuggler::LogicalOperation

# Reconstrói uma LogicalOperation a partir do spec serializável.
#   leaf:  { "lit" => value }
#   node:  { "op1" => spec, "operator" => str, "op2" => spec | nil }
def build(spec)
  return LO.new(spec["lit"]) if spec.key?("lit")

  op1 = build(spec["op1"])
  op2 = spec["op2"] ? build(spec["op2"]) : nil
  if spec["operator"].nil?
    op1
  else
    LO.new(op1, spec["operator"], op2)
  end
end

def lit(v)
  { "lit" => v }
end

def node(op1, operator, op2 = nil)
  { "op1" => op1, "operator" => operator, "op2" => op2 }
end

$cases = []

# Registra um caso: avalia a árvore e captura o resultado ou "error".
def tc(desc, tree)
  result = TaskJuggler::LogicalExpression.new(build(tree)).eval(nil)
  expected = if result == true || result == false
    result
  else
    # Só esperamos valores não-booleanos em casos de leaf; aqui normalizamos
    # para a forma textual para o TS comparar via `String(res)`.
    result.to_s
  end
  $cases << { description: desc, tree: tree, expected: expected }
rescue StandardError
  $cases << { description: desc, tree: tree, expected: "error" }
end

# --- Comparações numéricas (mesmo tipo) ---
tc("5 > 3 é true", node(lit(5), ">", lit(3)))
tc("3 > 5 é false", node(lit(3), ">", lit(5)))
tc("5 >= 5 é true", node(lit(5), ">=", lit(5)))
tc("5 >= 6 é false", node(lit(5), ">=", lit(6)))
tc("5 = 5 é true", node(lit(5), "=", lit(5)))
tc("5 = 6 é false", node(lit(5), "=", lit(6)))
tc("3 < 5 é true", node(lit(3), "<", lit(5)))
tc("6 < 5 é false", node(lit(6), "<", lit(5)))
tc("5 <= 5 é true", node(lit(5), "<=", lit(5)))
tc("6 <= 5 é false", node(lit(6), "<=", lit(5)))
tc("5 != 6 é true", node(lit(5), "!=", lit(6)))
tc("5 != 5 é false", node(lit(5), "!=", lit(5)))

# --- Comparações de string (mesmo tipo) ---
tc("'apple' < 'banana' é true", node(lit("apple"), "<", lit("banana")))
tc("'b' = 'a' é false", node(lit("b"), "=", lit("a")))

# --- Operadores lógicos ---
tc("(5 > 3) & (2 < 4) é true",
   node(node(lit(5), ">", lit(3)), "&", node(lit(2), "<", lit(4))))
tc("(5 > 3) & (4 < 2) é false",
   node(node(lit(5), ">", lit(3)), "&", node(lit(4), "<", lit(2))))
tc("(5 < 3) | (2 < 4) é true",
   node(node(lit(5), "<", lit(3)), "|", node(lit(2), "<", lit(4))))
tc("(5 < 3) | (2 > 4) é false",
   node(node(lit(5), "<", lit(3)), "|", node(lit(2), ">", lit(4))))

# --- Negação ---
tc("~(5 > 3) é false", node(node(lit(5), ">", lit(3)), "~"))
tc("~(5 < 3) é true", node(node(lit(5), "<", lit(3)), "~"))

# --- Lazy / short-circuit (operand2 tem operador inválido) ---
tc("& lazy: false & (erro) é false sem avaliar operand2",
   node(lit(false), "&", node(lit(1), "?", lit(2))))
tc("| lazy: true | (erro) é true sem avaliar operand2",
   node(lit(true), "|", node(lit(1), "?", lit(2))))

# --- Sem precedência (left-to-right) ---
# a | b & c  ==  (a | b) & c ; com a=true, b=false, c=false → false
tc("a | b & c = (a | b) & c é false (sem precedência)",
   node(node(node(lit(true), nil), "|", node(lit(false), nil)),
        "&", node(lit(false), nil)))

# --- Erros ---
tc("operador desconhecido gera erro", node(lit(true), "?", lit(false)))
tc("operand1 booleano em comparação gera erro", node(lit(true), "=", lit(1)))

puts({ cases: $cases }.to_json)
