/// <reference types="react" />
/// <reference types="react-dom" />

// Ensure JSX types are available globally
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> { }
    interface ElementClass extends React.Component<any> {
      render(): React.ReactNode;
    }
    interface ElementAttributesProperty { props: {}; }
    interface ElementChildrenAttribute { children: {}; }
    
    type LibraryManagedAttributes<C, P> = P;
    
    interface IntrinsicAttributes extends React.Attributes { }
    interface IntrinsicClassAttributes<T> extends React.ClassAttributes<T> { }
    
    interface IntrinsicElements {
      [elemName: string]: any;
      div: any;
      span: any;
      button: any;
      input: any;
      form: any;
      a: any;
      p: any;
      h1: any;
      h2: any;
      h3: any;
      h4: any;
      h5: any;
      h6: any;
      img: any;
      svg: any;
      path: any;
      textarea: any;
      select: any;
      option: any;
      label: any;
      ul: any;
      li: any;
      section: any;
      article: any;
      header: any;
      footer: any;
      nav: any;
      main: any;
    }
  }
}

// React types are already properly defined by @types/react
// No need to redeclare - TypeScript will use the official types

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
