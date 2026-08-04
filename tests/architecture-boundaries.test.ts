import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function files(directory: string): Promise<string[]> { const entries = await readdir(directory, { withFileTypes: true }); return (await Promise.all(entries.map(async (entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat().filter((file) => /\.[tj]sx?$/.test(file)); }
describe("production architecture boundaries", () => {
  it("keeps browser components free of PostgreSQL and server imports", async () => { const all = await files(join(process.cwd(), "src")); const sources = await Promise.all(all.map(async (file) => ({ file, source: await readFile(file, "utf8") }))); const clients = sources.filter(({ source }) => source.startsWith("\"use client\"") || source.startsWith("'use client'")); expect(clients.length).toBeGreaterThan(0); for (const { source } of clients) { expect(source).not.toMatch(/from ["']pg["']/); expect(source).not.toContain("postgres-dispatch-assignment-gateway"); expect(source).not.toContain("@/server/"); } });
  it("keeps the owner production path independent from mock fixtures and public secrets", async () => { const owner = await Promise.all((await files(join(process.cwd(), "src", "app", "owner"))).map((file) => readFile(file, "utf8"))); expect(owner.join("\n")).not.toContain("mockData"); const all = await Promise.all((await files(join(process.cwd(), "src"))).map((file) => readFile(file, "utf8"))); const source = all.join("\n"); expect(source).not.toContain("NEXT_PUBLIC_DATABASE_URL"); expect(source).not.toContain("NEXT_PUBLIC_SESSION_SECRET"); expect(source).not.toContain("NEXT_PUBLIC_OWNER_PASSWORD"); });
  it("keeps the production map projection free of mutations and mock fallbacks", async () => {
    const dispatchFeature = (await Promise.all((await files(join(process.cwd(), "src", "features", "dispatch"))).map((file) => readFile(file, "utf8")))).join("\n");
    expect(dispatchFeature).not.toContain("mockData");
    expect(dispatchFeature).not.toContain("@/app/actions");
    expect(dispatchFeature).not.toContain("dispatch-assignment-gateway");
    expect(dispatchFeature).not.toContain("confirmOwnerDispatch");
    expect(dispatchFeature).not.toContain("overrideOwnerDispatch");
    expect(dispatchFeature).not.toContain("setAssignments");
  });
  it("retires the transient RuntimeOverride operational source", async () => { const all = await Promise.all((await files(join(process.cwd(), "src"))).map((file) => readFile(file, "utf8"))); expect(all.join("\n")).not.toContain("RuntimeOverride"); });
  it("keeps daily OFF client UI free of database/server imports and recommendation authority", async () => {
    const panel = await readFile(join(process.cwd(), "src", "app", "owner", "OwnerDailyOffPanel.tsx"), "utf8");
    expect(panel).not.toMatch(/from ["']pg["']/);
    expect(panel).not.toContain("@/server/");
    expect(panel).not.toContain("suggestAssignments");
    expect(panel).not.toContain("scoreCandidate");
  });
  it("keeps production recommendation domain free of React, PostgreSQL, demo travel, and mutation authority", async () => {
    const source = await readFile(join(process.cwd(), "src", "domain", "production-candidate-recommendations.ts"), "utf8");
    expect(source).not.toMatch(/from ["'](?:react|pg|next)/);
    expect(source).not.toContain("demo-dispatch-composition");
    expect(source).not.toContain("TravelTimeProvider");
    expect(source).not.toContain("confirmOwnerDispatch");
    expect(source).not.toContain("overrideOwnerDispatch");
  });
});
