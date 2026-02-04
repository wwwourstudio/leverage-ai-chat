'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches React errors and provides graceful fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[v0] Error boundary caught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-gray-800/50 border border-gray-700 rounded-2xl p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Initialization Error
                </h1>
                <p className="text-gray-400 text-sm">
                  Something went wrong during app startup
                </p>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-xl p-4 mb-6">
              <p className="text-red-400 font-mono text-sm mb-2">
                {this.state.error?.name}: {this.state.error?.message}
              </p>
              {this.state.errorInfo && (
                <details className="text-gray-500 text-xs">
                  <summary className="cursor-pointer hover:text-gray-400">
                    Stack trace
                  </summary>
                  <pre className="mt-2 overflow-x-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <h3 className="text-white font-semibold mb-2">Common Causes:</h3>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>• Missing environment variables</li>
                  <li>• Database tables not created (migration not run)</li>
                  <li>• Supabase connection issues</li>
                  <li>• Network or API errors</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-2">Quick Fixes:</h3>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>1. Check all environment variables are set</li>
                  <li>2. Run database migration in Supabase SQL editor</li>
                  <li>3. Verify API keys are valid</li>
                  <li>4. Check browser console for detailed errors</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
              <a
                href="/INITIALIZATION_FIX_PLAN.md"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View Fix Guide
              </a>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-gray-500 text-xs text-center">
                For detailed troubleshooting, check the browser console (F12) and review 
                <span className="text-blue-400"> INITIALIZATION_FIX_PLAN.md</span>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
