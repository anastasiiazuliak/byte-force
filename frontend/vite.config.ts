import { defineConfig, loadEnv } from 'vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const assets = env.STATIC_PROXY_TARGET || 'http://127.0.0.1:5081';
  return { server: { proxy: {
    '/api': env.API_PROXY_TARGET || 'http://127.0.0.1:5080',
    '/terrain': assets, '/tiles': assets, '/metadata': assets, '/illumination': assets,
  } } };
});
