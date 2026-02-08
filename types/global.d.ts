/**
 * Global Type Declarations
 * Extends types for better TypeScript support
 */

// Ensure @supabase/ssr types are recognized
declare module '@supabase/ssr' {
  export * from '@supabase/ssr/dist/index';
}

// Environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY?: string;
      
      // AI Services
      XAI_API_KEY?: string;
      GROK_API_KEY?: string;
      
      // External APIs
      ODDS_API_KEY?: string;
      
      // Node environment
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

// Extend Window interface for browser globals
declare interface Window {
  // Add any browser-specific globals here
}

// Module augmentations for better type inference
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.svg' {
  const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

export {};
