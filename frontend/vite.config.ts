import { defineConfig, loadEnv } from 'vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return { server: { proxy: { '/api': env.API_PROXY_TARGET || 'http://localhost:5080' } } };
});
