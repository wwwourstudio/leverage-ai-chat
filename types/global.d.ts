// Global type declarations for external packages
// These packages have proper type definitions that TypeScript should auto-discover
// Only add explicit declarations if types are genuinely missing from node_modules

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
