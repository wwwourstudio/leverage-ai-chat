/**
 * Preview Mode Detection
 * Detects if app is running in v0 embedded preview and provides graceful fallbacks
 */

export function isInV0Preview(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    // Check if running in iframe
    const inIframe = window.self !== window.top;
    
    // Check for v0-specific iframe context
    const isV0Frame = inIframe && (
      window.location.ancestorOrigins?.[0]?.includes('v0.dev') ||
      document.referrer.includes('v0.dev')
    );
    
    return isV0Frame;
  } catch (e) {
    // If we can't access window.top due to cross-origin, we're likely in an iframe
    return true;
  }
}

export function shouldUseAuthFallback(): boolean {
  return isInV0Preview();
}

export function getPreviewMessage(): string {
  return "Preview Mode: Authentication disabled in v0 preview. Deploy to enable full auth features.";
}
