import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  // só afeta `npm run dev` (o Netlify usa o build, não o dev server). host:true
  // expõe na rede local; allowedHosts libera a URL temporária do Cloudflare
  // Tunnel usada pra testar a câmera em celular real (exige HTTPS).
  server: { host: true, allowedHosts: [".trycloudflare.com"] },
});
