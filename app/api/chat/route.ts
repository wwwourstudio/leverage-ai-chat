/**
 * /api/chat — alias for /api/analyze
 *
 * Some external callers (integrations, docs, older clients) POST to /api/chat.
 * The canonical endpoint is /api/analyze. Re-exporting its handler here means
 * both paths share identical behaviour with no duplication and no proxy hop.
 *
 * Note: maxDuration must be declared inline — Turbopack cannot recognize
 * re-exported route segment config from another module.
 */
export const maxDuration = 60;

export { POST } from '@/app/api/analyze/route';
