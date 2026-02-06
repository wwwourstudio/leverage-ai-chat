/// <reference types="react" />
/// <reference types="react-dom" />

// Ensure JSX types are available globally
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

declare module 'react' {
  export * from 'react';
  
  // Explicitly export commonly used hooks
  export function useState<S>(initialState: S | (() => S)): [S, React.Dispatch<React.SetStateAction<S>>];
  export function useEffect(effect: React.EffectCallback, deps?: React.DependencyList): void;
  export function useRef<T>(initialValue: T): React.MutableRefObject<T>;
  export function useRef<T>(initialValue: T | null): React.RefObject<T>;
  export function useRef<T = undefined>(): React.MutableRefObject<T | undefined>;
}

declare module 'react-dom' {
  export * from 'react-dom';
}

declare module 'next/server' {
  export * from 'next/dist/server/web/exports/next-server';
}

declare module 'next/font/google' {
  export * from 'next/dist/compiled/@next/font/dist/google';
}

declare module '@supabase/supabase-js' {
  export * from '@supabase/supabase-js';
}

declare module 'lucide-react' {
  export * from 'lucide-react';
}

declare module 'clsx' {
  export * from 'clsx';
}

declare module 'tailwind-merge' {
  export * from 'tailwind-merge';
}

declare module 'next-themes' {
  export * from 'next-themes';
}

declare module '@vercel/analytics/next' {
  export * from '@vercel/analytics/next';
}

// Global Node.js types
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_KEY?: string;
    XAI_API_KEY?: string;
    THE_ODDS_API_KEY?: string;
    [key: string]: string | undefined;
  }
}
