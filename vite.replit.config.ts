import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";

// Replit-specific configuration that extends the base config
// This adds allowedHosts to work with Replit's preview domains
export default mergeConfig(baseConfig, defineConfig({
  server: {
    allowedHosts: ["all"],
  },
}));
