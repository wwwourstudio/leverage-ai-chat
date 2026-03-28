/**
 * /api/chat — alias for /api/analyze
 *
 * Some external callers (integrations, docs, older clients) POST to /api/chat.
 * The canonical endpoint is /api/analyze. Re-exporting its handler here means
 * both paths share identical behaviour with no duplication and no proxy hop.
 */
export { POST, maxDuration } from '@/app/api/analyze/route';
