// Global type declarations for external packages

// Ensure Next.js server types are available
declare module 'next/server' {
  export { NextRequest, NextResponse } from 'next/dist/server/web/spec-extension/request';
}

// Ensure Supabase types are available
declare module '@supabase/supabase-js' {
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): any;
  export type SupabaseClient = any;
}

// Ensure next-themes types are available
declare module 'next-themes' {
  import { ReactNode } from 'react';
  
  export interface ThemeProviderProps {
    children: ReactNode;
    attribute?: string;
    defaultTheme?: string;
    enableSystem?: boolean;
    disableTransitionOnChange?: boolean;
    storageKey?: string;
    themes?: string[];
    forcedTheme?: string;
    nonce?: string;
  }
  
  export const ThemeProvider: React.FC<ThemeProviderProps>;
  export function useTheme(): {
    theme: string | undefined;
    setTheme: (theme: string) => void;
    forcedTheme: string | undefined;
    resolvedTheme: string | undefined;
    themes: string[];
    systemTheme: 'light' | 'dark' | undefined;
  };
}

// Ensure clsx and tailwind-merge types are available
declare module 'clsx' {
  export type ClassValue =
    | string
    | number
    | boolean
    | undefined
    | null
    | ClassValue[]
    | { [key: string]: any };
  
  export function clsx(...inputs: ClassValue[]): string;
}

declare module 'tailwind-merge' {
  export function twMerge(...inputs: string[]): string;
}
