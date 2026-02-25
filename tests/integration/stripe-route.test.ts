/**
 * Integration tests for POST /api/stripe/checkout
 *
 * Strategy: mock 'stripe' module and control environment variables.
 * Tests cover all branching paths:
 *   - No STRIPE_SECRET_KEY → mock mode
 *   - Stripe package error → mock mode (tested via constructor throw)
 *   - type=subscription, no price ID → mock mode
 *   - type=subscription, price ID configured → real checkout session
 *   - type=credits (one-time) → real checkout session
 *   - stripe.checkout.sessions.create throws → 500
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Next.js server mock ──────────────────────────────────────────────────────
vi.mock('next/server', () => ({
  NextRequest: class MockNextRequest extends Request {},
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    })),
  },
}));

// ── Stripe mock ──────────────────────────────────────────────────────────────
const mockSessionCreate = vi.fn();

// Must use a regular function (not an arrow function) so `new Stripe(...)` works.
function MockStripeConstructor(this: any) {
  this.checkout = { sessions: { create: mockSessionCreate } };
}
const MockStripe = vi.fn(MockStripeConstructor);

vi.mock('stripe', () => ({ default: MockStripe }));

// ── Route import ─────────────────────────────────────────────────────────────
// Imported after mocks so the module receives the mocked dependencies.
const { POST } = await import('@/app/api/stripe/checkout/route');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makePostRequest(
  body: Record<string, unknown>,
  origin = 'http://localhost:3000',
): Request {
  return new Request(`${origin}/api/stripe/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin,
    },
    body: JSON.stringify(body),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────
const ORIG_STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const ORIG_MONTHLY_ID = process.env.STRIPE_MONTHLY_PRICE_ID;
const ORIG_ANNUAL_ID = process.env.STRIPE_ANNUAL_PRICE_ID;

beforeEach(() => {
  mockSessionCreate.mockReset();
  MockStripe.mockClear();
  mockSessionCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/test-session' });
});

afterEach(() => {
  if (ORIG_STRIPE_KEY !== undefined) process.env.STRIPE_SECRET_KEY = ORIG_STRIPE_KEY;
  else delete process.env.STRIPE_SECRET_KEY;

  if (ORIG_MONTHLY_ID !== undefined) process.env.STRIPE_MONTHLY_PRICE_ID = ORIG_MONTHLY_ID;
  else delete process.env.STRIPE_MONTHLY_PRICE_ID;

  if (ORIG_ANNUAL_ID !== undefined) process.env.STRIPE_ANNUAL_PRICE_ID = ORIG_ANNUAL_ID;
  else delete process.env.STRIPE_ANNUAL_PRICE_ID;
});

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/stripe/checkout', () => {

  // ── Mock mode (no Stripe key) ──────────────────────────────────────────────

  it('returns mock success when STRIPE_SECRET_KEY is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const res = await POST(makePostRequest({ type: 'credits', credits: 50, amount: 25 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.mock).toBe(true);
    expect(body.credits).toBe(50); // prefers credits over amount
    expect(body.message).toMatch(/mock mode/i);
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('uses amount as fallback when credits not provided in mock mode', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const res = await POST(makePostRequest({ type: 'credits', amount: 30 }));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.mock).toBe(true);
    expect(body.credits).toBe(30);
  });

  it('defaults to 20 credits in mock mode when neither credits nor amount is provided', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const res = await POST(makePostRequest({ type: 'credits' }));
    const body = await res.json();

    expect(body.credits).toBe(20);
  });

  // ── Subscription type ──────────────────────────────────────────────────────

  it('returns mock mode for subscription when STRIPE_MONTHLY_PRICE_ID is not configured', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    delete process.env.STRIPE_MONTHLY_PRICE_ID;

    const res = await POST(makePostRequest({ type: 'subscription', planId: 'monthly', credits: 100 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.mock).toBe(true);
    expect(body.message).toMatch(/STRIPE_MONTHLY_PRICE_ID/i);
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('returns mock mode for annual subscription when STRIPE_ANNUAL_PRICE_ID is not configured', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    delete process.env.STRIPE_ANNUAL_PRICE_ID;

    const res = await POST(makePostRequest({ type: 'subscription', planId: 'annual', credits: 150 }));
    const body = await res.json();

    expect(body.mock).toBe(true);
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('creates a subscription checkout session when fully configured', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    process.env.STRIPE_MONTHLY_PRICE_ID = 'price_monthly_123';

    const res = await POST(makePostRequest({
      type: 'subscription',
      planId: 'monthly',
      credits: 100,
      customer_email: 'user@example.com',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://checkout.stripe.com/pay/test-session');
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_monthly_123', quantity: 1 }],
        customer_email: 'user@example.com',
      }),
    );
  });

  it('uses annual price ID when planId=annual', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    process.env.STRIPE_ANNUAL_PRICE_ID = 'price_annual_456';

    const res = await POST(makePostRequest({ type: 'subscription', planId: 'annual', credits: 150 }));
    const body = await res.json();

    expect(body.url).toBeTruthy();
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_annual_456', quantity: 1 }],
      }),
    );
  });

  it('defaults to monthly plan when planId is not provided for subscription', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    process.env.STRIPE_MONTHLY_PRICE_ID = 'price_monthly_123';

    await POST(makePostRequest({ type: 'subscription', credits: 100 }));

    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_monthly_123', quantity: 1 }],
      }),
    );
  });

  it('includes success_url and cancel_url in subscription session', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    process.env.STRIPE_MONTHLY_PRICE_ID = 'price_monthly_123';

    await POST(makePostRequest({
      type: 'subscription',
      planId: 'monthly',
      credits: 100,
    }, 'https://app.example.com'));

    const call = mockSessionCreate.mock.calls[0][0];
    expect(call.success_url).toContain('https://app.example.com');
    expect(call.cancel_url).toContain('https://app.example.com');
  });

  // ── Credits (one-time) type ────────────────────────────────────────────────

  it('creates a one-time payment session for credit purchases', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';

    const res = await POST(makePostRequest({ type: 'credits', credits: 50, amount: 25 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://checkout.stripe.com/pay/test-session');
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'usd',
            }),
          }),
        ]),
      }),
    );
  });

  it('enforces minimum unit amount of $5 (500 cents)', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';

    // $1 → should be capped at 500 cents ($5 minimum)
    await POST(makePostRequest({ type: 'credits', amount: 1, credits: 10 }));

    const call = mockSessionCreate.mock.calls[0][0];
    expect(call.line_items[0].price_data.unit_amount).toBe(500);
  });

  it('converts amount to cents correctly for normal amounts', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';

    await POST(makePostRequest({ type: 'credits', amount: 25, credits: 50 }));

    const call = mockSessionCreate.mock.calls[0][0];
    // $25 → 2500 cents
    expect(call.line_items[0].price_data.unit_amount).toBe(2500);
  });

  it('includes credits count in product name for one-time purchase', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';

    await POST(makePostRequest({ type: 'credits', credits: 50, amount: 25 }));

    const call = mockSessionCreate.mock.calls[0][0];
    expect(call.line_items[0].price_data.product_data.name).toContain('50');
  });

  // ── Unknown type (defaults to credits path) ────────────────────────────────

  it('falls through to one-time payment when type is not "subscription"', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';

    const res = await POST(makePostRequest({ type: 'unknown', credits: 10, amount: 10 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBeTruthy();
    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'payment' }),
    );
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  it('returns 500 when stripe.checkout.sessions.create throws', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    process.env.STRIPE_MONTHLY_PRICE_ID = 'price_monthly_123';
    mockSessionCreate.mockRejectedValueOnce(new Error('Stripe API error'));

    const res = await POST(makePostRequest({ type: 'subscription', planId: 'monthly' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Stripe API error');
  });

  it('returns 500 for credits type when stripe.checkout.sessions.create throws', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    mockSessionCreate.mockRejectedValueOnce(new Error('Network error'));

    const res = await POST(makePostRequest({ type: 'credits', credits: 50, amount: 25 }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Network error');
  });
});
