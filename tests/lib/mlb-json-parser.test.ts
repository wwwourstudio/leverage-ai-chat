import { describe, it, expect } from 'vitest';
import { extractMLBJson, parseMarkdownBettingText, type MLBAnalysis } from '../../lib/utils/mlb-json-parser';

describe('extractMLBJson', () => {
  it('parses a valid JSON string directly', () => {
    const input = JSON.stringify({
      pick: 'Giants ML',
      book: 'BetMGM',
      odds: '-104',
      discrepancy: '+100 vs -117',
      edge: '+2.5%',
    });
    const result = extractMLBJson(input);
    expect(result.pick).toBe('Giants ML');
    expect(result.book).toBe('BetMGM');
    expect(result.odds).toBe('-104');
    expect(result.discrepancy).toBe('+100 vs -117');
    expect(result.edge).toBe('+2.5%');
  });

  it('parses JSON wrapped in a ```json code block', () => {
    const input = '```json\n{"pick":"Giants ML","book":"DraftKings","odds":"+100","discrepancy":"+100 vs -117","edge":"2.5%"}\n```';
    const result = extractMLBJson(input);
    expect(result.pick).toBe('Giants ML');
    expect(result.book).toBe('DraftKings');
  });

  it('parses JSON wrapped in a plain ``` code block', () => {
    const input = '```\n{"pick":"A","book":"B","odds":"-110","discrepancy":"x","edge":"1%"}\n```';
    const result = extractMLBJson(input);
    expect(result.pick).toBe('A');
    expect(result.book).toBe('B');
  });

  it('extracts bare JSON from mixed text', () => {
    const input = 'Here is my analysis:\n{"pick":"Dodgers","book":"FanDuel","odds":"-120","discrepancy":"-120 vs -108","edge":"3%"}\nEnd.';
    const result = extractMLBJson(input);
    expect(result.pick).toBe('Dodgers');
    expect(result.book).toBe('FanDuel');
  });

  it('falls back to markdown parsing when no JSON is present', () => {
    const input =
      '**Pick:** Bet on **San Francisco Giants ML at -104** on BetMGM for value.\n' +
      '- **Edge from odds discrepancy:** Giants at **+100** on BetMGM vs. **-117** on DraftKings\n' +
      '  indicates potential sharp money on the underdog, offering a +2.5% implied edge.';
    const result = extractMLBJson(input);
    expect(result.pick).toBeTruthy();
    expect(result.book).toMatch(/BetMGM/i);
    expect(result.odds).toBeTruthy();
    expect(result.raw).toBe(input);
  });

  it('does not throw on empty string', () => {
    expect(() => extractMLBJson('')).not.toThrow();
    const result = extractMLBJson('');
    expect(result).toHaveProperty('pick');
  });
});

describe('parseMarkdownBettingText', () => {
  const sampleText =
    '**Pick:** Bet on **San Francisco Giants ML at -104** on BetMGM for value.\n' +
    '- **Edge from odds discrepancy:** Giants at **+100** on BetMGM vs. **-117** on DraftKings\n' +
    '  indicates potential sharp money on the underdog, offering a +2.5% implied edge based on line differences.';

  it('extracts the pick', () => {
    const result = parseMarkdownBettingText(sampleText);
    expect(result.pick).toContain('San Francisco Giants ML');
  });

  it('extracts the book', () => {
    const result = parseMarkdownBettingText(sampleText);
    expect(result.book).toMatch(/BetMGM/i);
  });

  it('extracts the odds', () => {
    const result = parseMarkdownBettingText(sampleText);
    expect(result.odds).toBe('-104');
  });

  it('extracts the discrepancy', () => {
    const result = parseMarkdownBettingText(sampleText);
    expect(result.discrepancy).toBeTruthy();
  });

  it('extracts the edge percentage', () => {
    const result = parseMarkdownBettingText(sampleText);
    expect(result.edge).toMatch(/%/);
  });

  it('stores raw text', () => {
    const result = parseMarkdownBettingText(sampleText);
    expect(result.raw).toBe(sampleText);
  });

  it('returns fallback values on completely unparseable input', () => {
    const result = parseMarkdownBettingText('random unrelated text with no betting info');
    expect(result).toMatchObject<Partial<MLBAnalysis>>({
      pick: expect.any(String),
      book: expect.any(String),
      odds: expect.any(String),
      discrepancy: expect.any(String),
      edge: expect.any(String),
    });
  });
});
