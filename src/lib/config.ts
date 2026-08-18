import type { DemoConfig } from '../types';

/** Connection settings come only from Vite env (`VITE_*`). Restart dev after editing `.env`. */
export function loadConfig(): DemoConfig {
  return {
    apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(
      /\/$/,
      '',
    ),
    wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3001/v1/stream',
    apiKey: (import.meta.env.VITE_API_KEY || '').trim(),
  };
}

export function configReady(config: DemoConfig): boolean {
  return Boolean(config.apiKey && config.apiBaseUrl && config.wsUrl);
}
