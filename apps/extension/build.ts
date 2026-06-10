// Build script for Kotomi Browser Extension.
// Compiles TypeScript sources to JavaScript and prepares dist/ for Chrome loading.
//
// Usage: npx tsx apps/extension/build.ts
//
// Output: apps/extension/dist/ — load this directory in Chrome as unpacked extension.

import { build } from "esbuild";
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from "fs";

const OUT_DIR = "apps/extension/dist";

mkdirSync(OUT_DIR, { recursive: true });

function htmlToJs(htmlPath: string, tsPath: string, outName: string): void {
  const html = readFileSync(htmlPath, "utf-8");
  const updated = html.replace(
    new RegExp(`src="\\./${tsPath}"`),
    `src="./${outName}"`,
  );
  writeFileSync(`${OUT_DIR}/${htmlPath.split("/").pop()}`, updated);
}

async function main(): Promise<void> {
  // 1. service-worker.ts → dist/service-worker.js (bundled as ESM)
  await build({
    entryPoints: ["apps/extension/src/background/service-worker.ts"],
    outfile: `${OUT_DIR}/service-worker.js`,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    external: ["chrome"],
  });
  // Post-process: fix OFFSCREEN_DOCUMENT_PATH for dist/ layout
  let swContent = readFileSync(`${OUT_DIR}/service-worker.js`, "utf-8");
  swContent = swContent.replace(
    /"src\/offscreen\/offscreen\.html"/,
    '"offscreen.html"',
  );
  writeFileSync(`${OUT_DIR}/service-worker.js`, swContent);
  console.log("✓ service-worker.js");

  // 2. offscreen.ts → dist/offscreen.js
  await build({
    entryPoints: ["apps/extension/src/offscreen/offscreen.ts"],
    outfile: `${OUT_DIR}/offscreen.js`,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    external: ["chrome"],
  });
  // Copy and update offscreen.html
  htmlToJs(
    "apps/extension/src/offscreen/offscreen.html",
    "offscreen.ts",
    "offscreen.js",
  );
  console.log("✓ offscreen.js + offscreen.html");

  // 3. popup.tsx → dist/popup.js
  await build({
    entryPoints: ["apps/extension/src/popup/popup.tsx"],
    outfile: `${OUT_DIR}/popup.js`,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    external: ["chrome"],
  });
  htmlToJs(
    "apps/extension/src/popup/popup.html",
    "popup.tsx",
    "popup.js",
  );
  console.log("✓ popup.js + popup.html");

  // 4. sidepanel.tsx → dist/sidepanel.js
  await build({
    entryPoints: ["apps/extension/src/sidepanel/sidepanel.tsx"],
    outfile: `${OUT_DIR}/sidepanel.js`,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    external: ["chrome"],
  });
  htmlToJs(
    "apps/extension/src/sidepanel/sidepanel.html",
    "sidepanel.tsx",
    "sidepanel.js",
  );
  console.log("✓ sidepanel.js + sidepanel.html");

  // 5. Copy index.html
  copyFileSync("apps/extension/index.html", `${OUT_DIR}/index.html`);
  console.log("✓ index.html");

  // 6. Generate manifest.json for dist/
  const manifest = {
    manifest_version: 3,
    name: "Kotomi Browser Extension",
    version: "0.1.1",
    description: "Capture tab audio and transcribe it with Kotomi.",
    permissions: ["tabCapture", "offscreen", "storage", "sidePanel", "activeTab"],
    background: {
      service_worker: "service-worker.js",
      type: "module",
    },
    action: {
      default_popup: "popup.html",
      default_title: "Kotomi Transcript",
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
    host_permissions: ["http://localhost/*", "http://127.0.0.1/*"],
  };
  writeFileSync(
    `${OUT_DIR}/manifest.json`,
    JSON.stringify(manifest, null, 2),
  );
  console.log("✓ manifest.json");

  console.log("\nBuild complete → ", OUT_DIR);
  console.log("Load this directory in Chrome: chrome://extensions → Developer mode → Load unpacked");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
