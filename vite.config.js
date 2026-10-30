import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Build en un seul fichier HTML autonome (facile à héberger ou à publier)
export default defineConfig({ plugins: [react(), viteSingleFile()] })
