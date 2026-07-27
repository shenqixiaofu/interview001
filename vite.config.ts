import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 渲染进程仅负责界面，系统能力统一经 preload 暴露。
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    strictPort: true
  }
});
