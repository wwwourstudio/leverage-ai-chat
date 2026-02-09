/**
 * Integration Tests for Analyze API Route
 * Tests the main AI analysis endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../analyze/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('ai', () => ({
  generateText: vi.fn()
}));

vi.mock('@/lib/leveraged-ai', () => ({
  LeveragedAI: {
    isReady: vi.fn(() => true),
    insertWithAIValidation: vi.fn()
  }
}));

describe('POST /api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up environment variables
    process.env.XAI_API_KEY = 'test-key';
  });

  it('should return 400 when message is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Message is required');
  });

  it('should return 500 when AI gateway is not configured', async () => {
    delete process.env.XAI_API_KEY;
    
    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Test query',
        context: {}
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('not configured');
  });

  it('should successfully analyze a valid query', async () => {
    const { generateText } = await import('ai');
    
    vi.mocked(generateText).mockResolvedValue({
      text: 'AI generated response',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 20 }
    } as any);

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What are the best NBA bets today?',
        context: {
          sport: 'nba',
          marketType: 'h2h',
          platform: 'betting'
        }
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.text).toBe('AI generated response');
    expect(data.model).toBeDefined();
  });

  it('should extract sport context from message', async () => {
    const { generateText } = await import('ai');
    
    vi.mocked(generateText).mockResolvedValue({
      text: 'Response about NFL',
      finishReason: 'stop'
    } as any);

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        message: 'NFL picks for Sunday',
        context: {}
      })
    });

    await POST(request);

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'xai/grok-3'
      })
    );
  });

  it('should handle AI API errors gracefully', async () => {
    const { generateText } = await import('ai');
    
    vi.mocked(generateText).mockRejectedValue(
      new Error('AI Gateway timeout')
    );

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Test query',
        context: {}
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.useFallback).toBe(true);
  });

  it('should store trust metrics when database is ready', async () => {
    const { generateText } = await import('ai');
    const { LeveragedAI } = await import('@/lib/leveraged-ai');
    
    vi.mocked(generateText).mockResolvedValue({
      text: 'Response',
      finishReason: 'stop'
    } as any);

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Test',
        context: {}
      })
    });

    await POST(request);

    expect(LeveragedAI.isReady).toHaveBeenCalled();
  });
});
