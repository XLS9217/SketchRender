// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // Allows access from your local network
    port: 3000 // Optionally, specify a port number (default is 3000)
  }
});