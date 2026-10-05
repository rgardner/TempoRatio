import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base keeps asset paths valid under any GitHub Pages project path.
  base: './',
  plugins: [react()],
});
