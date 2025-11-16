import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config.js";

// Replit-specific configuration that extends the base config
// This adds allowedHosts to work with Replit's preview domains
export default mergeConfig(await baseConfig, defineConfig({
  server: {
    allowedHosts: true,
  },
}));
