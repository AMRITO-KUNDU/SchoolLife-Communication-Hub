/**
 * API base URL helper.
 *
 * When VITE_API_URL is set (e.g. on Vercel pointing at Render) every fetch
 * goes cross-origin to that host.  When it is empty the path is kept relative
 * so same-origin rewrites (local dev proxy / Vercel rewrite rule) still work
 * without any change.
 */
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}
