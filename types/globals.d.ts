/// <reference types="react" />
/// <reference types="react-dom" />

declare module 'react' {
  export * from 'react';
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
