import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained index.html: loads from file:// inside the Capacitor WebView with no asset paths to break.
export default defineConfig({ plugins: [viteSingleFile()], build: { target: 'es2020' } });
