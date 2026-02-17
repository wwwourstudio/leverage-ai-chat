import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function debugLog(message: string, data?: any) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[v0] ${message}`, data || '');
  }
}

export class PerformanceTimer {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = Date.now();
  }

  end() {
    const elapsed = Date.now() - this.startTime;
    debugLog(`${this.label} took ${elapsed}ms`);
    return elapsed;
  }
}
