import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DEPLOY_SH = path.resolve(__dirname, "../../deploy.sh");

let home: string;
let log: string;

function setup(env: string, failOn?: string) {
  mkdirSync(path.join(home, env, "badge"), { recursive: true });
  const bin = path.join(home, "bin");
  mkdirSync(bin, { recursive: true });
  const fake = path.join(bin, "docker");
  writeFileSync(
    fake,
    `#!/bin/sh\necho "$*" >> "${log}"\n${failOn ? `case "$*" in *${failOn}*) exit 1;; esac\n` : ""}exit 0\n`,
  );
  chmodSync(fake, 0o755);
  return bin;
}

function run(env: string, failOn?: string) {
  const bin = setup(env, failOn);
  const res = spawnSync("sh", [DEPLOY_SH, env, "sha-test"], {
    env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` },
    encoding: "utf8",
  });
  const lines = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
  return { status: res.status, lines };
}

beforeEach(() => {
  home = mkdtempSync(path.join(tmpdir(), "deploy-sh-"));
  log = path.join(home, "docker.log");
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

describe("deploy.sh", () => {
  it("est syntaxiquement valide", () => {
    expect(spawnSync("sh", ["-n", DEPLOY_SH]).status).toBe(0);
  });

  it("prod : exactement les commandes d'origine", () => {
    const { status, lines } = run("prod");
    expect(status).toBe(0);
    expect(lines).toEqual([
      "compose pull renderer app tools",
      "compose up -d --no-deps renderer init app worker",
      "image prune -f",
    ]);
  });

  it("preprod : arret app/worker, seed-demo, puis relance, apres le pull", () => {
    const { status, lines } = run("preprod");
    expect(status).toBe(0);
    const f = "compose -f docker-compose.preprod.yml";
    expect(lines).toEqual([
      `${f} pull renderer app tools`,
      `${f} stop app worker`,
      `${f} run --rm seed-demo`,
      `${f} up -d --no-deps renderer init app worker`,
      "image prune -f",
    ]);
  });

  it("preprod : echec de seed-demo, arret sans relance", () => {
    const { status, lines } = run("preprod", "seed-demo");
    expect(status).not.toBe(0);
    expect(lines.some((l) => l.includes("seed-demo"))).toBe(true);
    expect(lines.some((l) => l.includes("up -d"))).toBe(false);
  });
});
