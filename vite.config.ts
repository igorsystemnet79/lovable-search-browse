import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

const apiOrigin = (process.env.PONUDIMI_API_ORIGIN || "https://ponudimi-test-api.onrender.com").replace(/\\/$/, "");

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    nitro({
      preset: "node-server",
      routeRules: {
        // Same-origin proxy: browser never talks directly to the API, so auth
        // bearer tokens and image uploads work without cross-origin/CORS issues.
        "/api/**": { proxy: `${apiOrigin}/api/**` },
        "/uploads/**": { proxy: `${apiOrigin}/uploads/**` },
      },
    }),
    viteReact(),
  ],
  server: { host: "0.0.0.0" },
});
