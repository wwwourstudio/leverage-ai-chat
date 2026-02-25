/**
 * Unit Tests for lib/utils.ts
 * Covers: cn() — clsx + tailwind-merge class name utility
 */

import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('returns a single class unchanged', () => {
    expect(cn('text-red-500')).toBe('text-red-500');
  });

  it('joins multiple classes with a space', () => {
    expect(cn('flex', 'items-center', 'gap-4')).toBe('flex items-center gap-4');
  });

  it('omits falsy values (false, null, undefined, 0)', () => {
    expect(cn('base', false, null, undefined, 0 as never, 'end')).toBe('base end');
  });

  it('includes classes from truthy conditional expressions', () => {
    const active = true;
    expect(cn('btn', active && 'btn-active')).toBe('btn btn-active');
  });

  it('excludes classes from falsy conditional expressions', () => {
    const active = false;
    expect(cn('btn', active && 'btn-active')).toBe('btn');
  });

  it('handles object syntax (clsx)', () => {
    expect(cn({ 'font-bold': true, italic: false })).toBe('font-bold');
  });

  it('handles array syntax (clsx)', () => {
    expect(cn(['flex', 'gap-2'])).toBe('flex gap-2');
  });

  it('merges conflicting Tailwind utilities (last one wins)', () => {
    // tailwind-merge deduplicates conflicting classes
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('deduplicates the same class', () => {
    expect(cn('flex', 'flex')).toBe('flex');
  });

  it('returns an empty string when given no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns an empty string for all-falsy inputs', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles nested arrays', () => {
    expect(cn(['flex', ['items-center', 'gap-2']])).toBe('flex items-center gap-2');
  });

  it('preserves responsive and state prefixes', () => {
    expect(cn('md:flex', 'hover:bg-blue-500', 'dark:text-white')).toBe(
      'md:flex hover:bg-blue-500 dark:text-white'
    );
  });

  it('merges responsive variants correctly', () => {
    // Same responsive prefix → last wins
    expect(cn('md:p-2', 'md:p-6')).toBe('md:p-6');
  });
});
