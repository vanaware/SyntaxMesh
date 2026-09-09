# TODO 2.3 — Duração

## Contexto

O Core precisa representar durações de tarefas.

## Objetivo

Implementar o tipo Duration.

## Arquivos

- src/core/time/duration.ts
- tests/core/duration_test.ts

## Requisitos

- Suportar horas
- Suportar dias
- Suportar semanas
- Validar valores negativos
- Validar valores inválidos

## Fora de escopo

- Calendários
- Esforço
- Scheduler

## Critério de aceite

- deno test passando
- deno lint passando
- deno fmt --check passando

## Testes

- criar duração de 8h
- criar duração de 1d
- converter 1d em horas
- rejeitar duração negativa