declare global {
  interface Window {
    __APP_CONFIG__?: { apiUrl?: string };
  }
}

const FALLBACK_API_URL = "http://localhost:8080";

/**
 * Backend base URL (PDF §1.2: changeable through an environment variable).
 * 1. `window.__APP_CONFIG__.apiUrl` — written at container start from `API_URL` (see nginx template)
 * 2. `VITE_API_URL` — for `npm run dev`
 * 3. http://localhost:8080
 */
export function apiBaseUrl(): string {
  const fromRuntime = typeof window !== "undefined" ? window.__APP_CONFIG__?.apiUrl : undefined;
  const fromBuild = import.meta.env.VITE_API_URL as string | undefined;
  const url = (fromRuntime || fromBuild || FALLBACK_API_URL).trim();
  return url.replace(/\/+$/, "");
}
