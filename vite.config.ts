// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Render.com (sets RENDER=true) needs a Node server build instead of the default Cloudflare one.
const isRender = !!process.env["RENDER"];

// .env is not in git, so external hosts (Render) build without backend config.
// These are public (publishable) values, safe to ship in the browser bundle.
if (isRender) {
  process.env["VITE_SUPABASE_URL"] ||=
    "https://c--3171d41b-d686-4f76-8f18-d8d120b20ddb-prod.lovable.cloud";
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||= "sb_publishable_WLql0EGS-8nDyqbNoAzwTQ_kWXyAS0H";
  process.env["VITE_SUPABASE_PROJECT_ID"] ||= "edsedwpqlqfqfjafxirk";
  process.env["SUPABASE_URL"] ||= process.env["VITE_SUPABASE_URL"];
  process.env["SUPABASE_PUBLISHABLE_KEY"] ||= process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(isRender ? { nitro: { preset: "node-server" } } : {}),
});
