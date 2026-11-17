import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'recharts-vendor';
            if (id.includes('html2pdf') || id.includes('html2canvas') || id.includes('jspdf')) return 'pdf-vendor';
            if (id.includes('@tiptap') || id.includes('prosemirror')) return 'tiptap-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            if (id.includes('@supabase')) return 'supabase-vendor';
            if (id.includes('react-router') || id.includes('react-router-dom')) return 'router-vendor';
            if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
          }
        }
      }
    }
  }
})
