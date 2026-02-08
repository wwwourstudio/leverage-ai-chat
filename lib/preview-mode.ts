'use client';

/**
 * Detects if the app is running in v0 preview/iframe mode
 * Used to gracefully handle browser restrictions in embedded contexts
 */
export function isInV0Preview(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    // Check if running in an iframe
    const inIframe = window.self !== window.top;
    
    // Check if the parent is v0.dev domain
    if (inIframe) {
      try {
        const parentHostname = window.top?.location.hostname;
        return parentHostname?.includes('v0.dev') || false;
      } catch (e) {
        // Cross-origin error means we're in an iframe from different origin
        // Likely v0 preview
        return true;
      }
    }
    
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Gets the current environment type
 */
export function getEnvironment(): 'preview' | 'production' | 'development' {
  if (typeof window === 'undefined') return 'production';
  
  if (isInV0Preview()) return 'preview';
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'development';
  }
  return 'production';
}
