import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3008,
    headers: {
      // Required for SharedArrayBuffer (WebGPU timing)
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
