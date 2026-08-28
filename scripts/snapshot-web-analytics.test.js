/**
 * Testes do scripts/snapshot-web-analytics.js
 *
 * Correm com o runner embutido do Node — sem dependências novas:
 *     node --test scripts/
 *
 * Cobre a aritmética de datas e o parsing de argumentos: a parte que falha
 * em silêncio (um retrato do dia errado parece perfeitamente normal) e que
 * só se nota meses depois, quando já não há como recuperar os dados.
 * A camada HTTP não é testada aqui: precisa de token e de rede.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  dayBounds,
  monthBounds,
  shiftDay,
  yesterdayUtc,
  previousMonthUtc,
  parseArgs,
  mudou,
  writeJsonAtomic,
} from "./snapshot-web-analytics.js";

test("limites do dia cobrem do primeiro ao último milissegundo", () => {
  assert.deepEqual(dayBounds("2026-08-28"), {
    since: "2026-08-28T00:00:00.000Z",
    until: "2026-08-28T23:59:59.999Z",
  });
});

test("limites do mês", async (t) => {
  await t.test("mês de 31 dias", () => {
    assert.deepEqual(monthBounds("2026-08"), {
      since: "2026-08-01T00:00:00.000Z",
      until: "2026-08-31T23:59:59.999Z",
    });
  });

  await t.test("mês de 30 dias", () => {
    assert.equal(monthBounds("2026-04").until, "2026-04-30T23:59:59.999Z");
  });

  await t.test("Fevereiro comum acaba a 28", () => {
    assert.equal(monthBounds("2026-02").until, "2026-02-28T23:59:59.999Z");
  });

  await t.test("Fevereiro bissexto acaba a 29", () => {
    assert.equal(monthBounds("2028-02").until, "2028-02-29T23:59:59.999Z");
  });

  await t.test("Dezembro não escorrega para Janeiro", () => {
    assert.equal(monthBounds("2026-12").until, "2026-12-31T23:59:59.999Z");
  });
});

test("deslocar dias", async (t) => {
  await t.test("dentro do mesmo mês", () => {
    assert.equal(shiftDay("2026-08-28", -1), "2026-08-27");
  });

  await t.test("atravessa a fronteira do mês", () => {
    assert.equal(shiftDay("2026-08-01", -1), "2026-07-31");
  });

  await t.test("atravessa a fronteira do ano", () => {
    assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");
  });

  await t.test("respeita o 29 de Fevereiro num ano bissexto", () => {
    assert.equal(shiftDay("2028-03-01", -1), "2028-02-29");
  });

  await t.test("avança também", () => {
    assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  });
});

test("ontem em UTC", async (t) => {
  await t.test("no meio do mês", () => {
    assert.equal(yesterdayUtc(new Date("2026-08-28T03:15:00Z")), "2026-08-27");
  });

  await t.test("no dia 1 devolve o último do mês anterior", () => {
    assert.equal(yesterdayUtc(new Date("2026-09-01T03:15:00Z")), "2026-08-31");
  });

  await t.test("logo depois da meia-noite UTC, e não o próprio dia", () => {
    assert.equal(yesterdayUtc(new Date("2026-08-28T00:00:01Z")), "2026-08-27");
  });
});

test("mês anterior em UTC", async (t) => {
  await t.test("no meio do ano", () => {
    assert.equal(previousMonthUtc(new Date("2026-08-15T00:00:00Z")), "2026-07");
  });

  await t.test("em Janeiro devolve Dezembro do ano anterior", () => {
    assert.equal(previousMonthUtc(new Date("2026-01-03T03:15:00Z")), "2025-12");
  });

  await t.test("no dia 1 devolve o mês que acabou de fechar", () => {
    assert.equal(previousMonthUtc(new Date("2026-09-01T03:15:00Z")), "2026-08");
  });

  await t.test("preenche o mês com zero à esquerda", () => {
    assert.equal(previousMonthUtc(new Date("2026-10-05T00:00:00Z")), "2026-09");
  });
});

test("argumentos", async (t) => {
  await t.test("sem argumentos, o alvo é ontem", () => {
    const o = parseArgs([]);
    assert.equal(o.alvos.length, 1);
    assert.equal(o.alvos[0].tipo, "day");
    assert.equal(o.dryRun, false);
  });

  await t.test("--day com data explícita", () => {
    assert.deepEqual(parseArgs(["--day", "2026-08-28"]).alvos, [
      { tipo: "day", chave: "2026-08-28" },
    ]);
  });

  await t.test("--month sem valor usa o mês anterior", () => {
    const o = parseArgs(["--month"]);
    assert.equal(o.alvos[0].tipo, "month");
    assert.match(o.alvos[0].chave, /^[0-9]{4}-[0-9]{2}$/);
  });

  await t.test("--month com valor explícito", () => {
    assert.deepEqual(parseArgs(["--month", "2026-07"]).alvos, [
      { tipo: "month", chave: "2026-07" },
    ]);
  });

  await t.test("--dry-run não é confundido com o valor de --day", () => {
    const o = parseArgs(["--day", "--dry-run"]);
    assert.equal(o.dryRun, true);
    assert.equal(o.alvos[0].tipo, "day");
    assert.match(o.alvos[0].chave, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
  });

  await t.test("--backfill gera N dias em ordem cronológica, sem incluir hoje", () => {
    const o = parseArgs(["--backfill", "3"]);
    assert.equal(o.alvos.length, 3);
    assert.ok(o.alvos.every((a) => a.tipo === "day"));
    const chaves = o.alvos.map((a) => a.chave);
    assert.deepEqual([...chaves].sort(), chaves);
    assert.ok(!chaves.includes(new Date().toISOString().slice(0, 10)));
  });

  await t.test("dia e mês na mesma corrida", () => {
    assert.deepEqual(parseArgs(["--day", "2026-08-31", "--month", "2026-08"]).alvos, [
      { tipo: "day", chave: "2026-08-31" },
      { tipo: "month", chave: "2026-08" },
    ]);
  });
});

test("detecção de alterações", async (t) => {
  const tmp = path.join(os.tmpdir(), `wa-usk-${process.pid}.json`);

  await t.test("ficheiro inexistente conta como alteração", () => {
    assert.equal(mudou(path.join(os.tmpdir(), "nao-existe-de-todo.json"), { a: 1 }), true);
  });

  await t.test("o carimbo temporal sozinho não conta como alteração", () => {
    fs.writeFileSync(tmp, JSON.stringify({ geradoEm: "2026-01-01T00:00:00Z", total: { visitors: 5 } }));
    assert.equal(mudou(tmp, { geradoEm: "2026-06-06T12:00:00Z", total: { visitors: 5 } }), false);
    fs.unlinkSync(tmp);
  });

  await t.test("um número diferente conta como alteração", () => {
    fs.writeFileSync(tmp, JSON.stringify({ geradoEm: "2026-01-01T00:00:00Z", total: { visitors: 5 } }));
    assert.equal(mudou(tmp, { geradoEm: "2026-01-01T00:00:00Z", total: { visitors: 6 } }), true);
    fs.unlinkSync(tmp);
  });

  await t.test("ficheiro corrompido é reescrito em vez de rebentar", () => {
    fs.writeFileSync(tmp, "{ isto nao e json");
    assert.equal(mudou(tmp, { total: { visitors: 1 } }), true);
    fs.unlinkSync(tmp);
  });
});

test("escrita atómica grava JSON legível e não deixa temporários", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wa-atomic-"));
  const alvo = path.join(dir, "x.json");
  writeJsonAtomic(alvo, { total: { visitors: 3 }, acentos: "ção" });
  assert.deepEqual(JSON.parse(fs.readFileSync(alvo, "utf8")), {
    total: { visitors: 3 },
    acentos: "ção",
  });
  assert.deepEqual(fs.readdirSync(dir), ["x.json"]);
  fs.rmSync(dir, { recursive: true, force: true });
});
