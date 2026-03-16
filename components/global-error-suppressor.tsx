'use client';

import { useEffect } from 'react';

/**
 * Patches browser Range.prototype.selectNode to guard against calls on
 * detached nodes (nodes with no parentNode). This prevents uncaught
 * InvalidNodeTypeError exceptions that arise from third-party or bundled
 * code calling range.selectNode() on a node that React has already
 * removed from the DOM during a concurrent re-render.
 *
 * Also installs a window 'error' capture listener as a backstop for any
 * remaining InvalidNodeTypeError / selectNode errors we can't intercept
 * at the API level.
 */
export function GlobalErrorSuppressor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ── Patch Range.prototype.selectNode ───────────────────────────────────
    // The native API throws InvalidNodeTypeError if the node has no parent.
    // Guard: silently skip detached nodes instead of throwing.
    const originalSelectNode = Range.prototype.selectNode;
    Range.prototype.selectNode = function patchedSelectNode(node: Node) {
      if (!node.parentNode) return; // node is detached — skip silently
      originalSelectNode.call(this, node);
    };

    // ── Backstop: window error event ───────────────────────────────────────
    // Catch any InvalidNodeTypeError that still escapes (e.g. from bundles
    // that cache a range reference before our patch runs).
    const handleWindowError = (event: ErrorEvent) => {
      if (
        event.error instanceof DOMException &&
        event.error.name === 'InvalidNodeTypeError' &&
        typeof event.message === 'string' &&
        event.message.includes('selectNode')
      ) {
        event.preventDefault(); // suppress uncaught error reporting
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener('error', handleWindowError, true);

    return () => {
      // Restore original on cleanup (strict-mode double-mount safety)
      Range.prototype.selectNode = originalSelectNode;
      window.removeEventListener('error', handleWindowError, true);
    };
  }, []);

  return null;
}
