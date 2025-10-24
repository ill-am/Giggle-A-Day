#!/usr/bin/env node
// scripts/dedupe_prompts.js
// Skeleton dedupe script for Phase 4. This script should be safe to run in
// dry-run mode and must be tested on a staging snapshot before applying to any
// real data.

const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const normalizePrompt = require("../utils/normalizePrompt");

async function run({ dryRun = true } = {}) {
  const prisma = new PrismaClient();
  try {
    console.log("Starting dedupe (dryRun=%s)", dryRun);
    const prompts = await prisma.prompt.findMany({
      orderBy: { createdAt: "asc" },
    });
    const map = new Map();
    for (const p of prompts) {
      const norm = normalizePrompt(p.prompt || "");
      const hash = crypto.createHash("sha256").update(norm).digest("hex");
      if (!map.has(hash)) map.set(hash, []);
      map
        .get(hash)
        .push({ id: p.id, prompt: p.prompt, createdAt: p.createdAt });
    }

    let duplicates = 0;
    for (const [hash, group] of map.entries()) {
      if (group.length <= 1) continue;
      duplicates += group.length - 1;
      console.log(
        `Found ${group.length} duplicates for hash ${hash}:`,
        group.map((x) => x.id)
      );
      // Strategy: keep earliest createdAt as canonical. In non-dry-run we'd:
      // 1) reassign ai_results.promptId to canonical id for others
      // 2) delete duplicate prompt rows
      // For safety, this script only logs when dryRun=true.
    }

    console.log("Total duplicate prompt rows found:", duplicates);
    if (!dryRun) {
      console.log(
        "Non-dry-run not implemented in skeleton. Implement carefully."
      );
    }
  } finally {
    try {
      await prisma.$disconnect();
    } catch (e) {}
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dry = args.includes("--no-dry-run") ? false : true;
  run({ dryRun: dry }).catch((err) => {
    console.error("dedupe script failed", err);
    process.exit(1);
  });
}

module.exports = { run };
