import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages publica este repositório em /auto-viral/.
  base: '/auto-viral/',
});
