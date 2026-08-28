#!/usr/bin/env node
/**
 * Gera public/data-manifest.json — a lista dos ficheiros de dados que a página
 * deve carregar, por ordem.
 *
 * Porquê: sem esta lista, o index.html tinha de adivinhar. Tentava 8 nomes de
 * ficheiro "único" × 4 pastas, depois 4 padrões de batch × 100 números, e parava
 * ao fim de 3 falhas seguidas — dezenas de 404 na consola e um pedido de cada
 * vez, à espera do anterior. Com o manifesto pede-se só o que existe, e tudo em
 * paralelo.
 *
 * Corre sozinho no workflow de actualização, a seguir ao scrape e antes do
 * commit, por isso não pode ficar dessincronizado dos batches.
 *
 * USO: node scripts/build-data-manifest.js
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT = path.join(PUBLIC_DIR, "data-manifest.json");

const entries = await fs.readdir(PUBLIC_DIR);

// Só os batches da raiz do public/. O public/arquivo/ é histórico e não é servido
// como dados da página.
const files = entries
  .filter((f) => /^batch_\d+\.json$/.test(f))
  .sort((a, b) => a.localeCompare(b, "en"));

if (files.length === 0) {
  console.error("ERRO: nenhum batch_*.json em public/ — manifesto não escrito.");
  process.exit(1);
}

// Sem timestamp de propósito: assim o ficheiro só muda quando os dados mudam, e
// o "commitar apenas se houver novidades" do workflow continua a funcionar.
const manifest = { files };

await fs.writeFile(OUT, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`public/data-manifest.json: ${files.length} ficheiros (${files[0]} … ${files[files.length - 1]})`);
