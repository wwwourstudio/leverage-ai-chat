'use client';

import { useState, useCallback } from 'react';
import { X, CreditCard, Sparkles, CheckCircle, Loader2, Shield, Zap, Crown, AlertTriangle, ArrowLeft } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { CREDIT_PACKAGES, SUBSCRIPTION_PLANS } from '@/lib/constants';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
);

interface StripeLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  onCreditsAdded?: (amount: number) => void;
  creditsRemaining: number;
  userEmail?: string;
}

type PurchaseTab = 'credits' | 'subscription';
type ViewState = 'select' | 'checkout';

export function StripeLightbox({ isOpen, onClose, onCreditsAdded, creditsRemaining, userEmail }: StripeLightboxProps) {
  const [activeTab, setActiveTab] = useState<PurchaseTab>('credits');
  const [view, setView] = useState<ViewState>('select');
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('annual');
  const [processing, setProcessing] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pendingCredits, setPendingCredits] = useState(0);

  // fetchClientSecret is memoized so EmbeddedCheckoutProvider doesn't re-fetch on re-render
  const [fetchClientSecret, setFetchClientSecret] = useState<(() => Promise<string>) | null>(null);

  const startEmbeddedCheckout = async (body: Record<string, unknown>, creditAmount: number) => {
    setProcessing(true);
    setCheckoutError(null);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, customer_email: userEmail }),
      });
      const data = await response.json();

      if (data.clientSecret) {
        setPendingCredits(creditAmount);
        // Wrap in a factory so EmbeddedCheckoutProvider gets a stable () => Promise<string>
        const secret = data.clientSecret as string;
        setFetchClientSecret(() => () => Promise.resolve(secret));
        setView('checkout');
      } else if (data.success && data.mock) {
        // Mock mode — no real Stripe, credit immediately
        onCreditsAdded?.(creditAmount);
        handleClose();
      } else {
        setCheckoutError(data.error || 'Payment could not be started. Please try again.');
      }
    } catch (err) {
      console.error('[Stripe] Checkout failed:', err);
      setCheckoutError('Payment could not be started. Please try again.');
    }
    setProcessing(false);
  };

  const handlePurchaseCredits = () => {
    const amount = selectedPackage ?? (parseInt(customAmount) || 0);
    if (amount < 5) return;
    startEmbeddedCheckout({ type: 'credits', amount, credits: amount }, amount);
  };

  const handleSubscribe = () => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
    if (!plan) return;
    startEmbeddedCheckout({ type: 'subscription', planId: plan.id, credits: plan.credits }, plan.credits);
  };

  const handleClose = () => {
    setView('select');
    setFetchClientSecret(null);
    setCheckoutError(null);
    setPendingCredits(0);
    onClose();
  };

  const handleCheckoutComplete = useCallback(() => {
    // Called when embedded checkout succeeds
    if (pendingCredits > 0) {
      onCreditsAdded?.(pendingCredits);
    }
    handleClose();
  }, [pendingCredits]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-in" onClick={handleClose}>
      <div
        className="relative w-full md:max-w-lg max-h-[90vh] md:max-h-[85vh] md:mx-4 bg-gray-900 border border-[var(--border-subtle)] rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up md:animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            {view === 'checkout' && (
              <button
                onClick={() => { setView('select'); setFetchClientSecret(null); setCheckoutError(null); }}
                className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300 mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {view === 'checkout' ? 'Secure Checkout' : 'Get Credits'}
              </h2>
              <p className="text-xs text-gray-500">
                {view === 'checkout'
                  ? 'Complete your purchase below'
                  : `You have ${creditsRemaining} credits remaining`}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {checkoutError && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2 flex-shrink-0">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{checkoutError}</span>
          </div>
        )}

        {/* Embedded Checkout view */}
        {view === 'checkout' && fetchClientSecret ? (
          <div className="flex-1 overflow-auto">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{
                fetchClientSecret,
                onComplete: handleCheckoutComplete,
              }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : (
          <>
            {/* Tab Nav */}
            <div className="flex border-b border-gray-800 flex-shrink-0">
              <button
                onClick={() => setActiveTab('credits')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 ${
                  activeTab === 'credits'
                    ? 'text-green-400 border-green-400 bg-green-500/5'
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                <Zap className="w-4 h-4" />
                One-Time Credits
              </button>
              <button
                onClick={() => setActiveTab('subscription')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 ${
                  activeTab === 'subscription'
                    ? 'text-purple-400 border-purple-400 bg-purple-500/5'
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                <Crown className="w-4 h-4" />
                Subscribe
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'credits' ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">1 credit = 1 AI analysis. Choose a package or enter a custom amount.</p>

                  {/* Credit packages */}
                  <div className="grid grid-cols-3 gap-2">
                    {CREDIT_PACKAGES.map(pkg => (
                      <button
                        key={pkg.amount}
                        onClick={() => { setSelectedPackage(pkg.amount); setCustomAmount(''); }}
                        className={`relative p-3 rounded-xl text-center transition-all ${
                          selectedPackage === pkg.amount
                            ? 'bg-green-600/20 border-green-500/50 text-green-400 border-2'
                            : 'bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        {pkg.popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-green-600 text-white text-[9px] font-bold rounded-full">
                            POPULAR
                          </span>
                        )}
                        <p className="text-lg font-black">{pkg.label}</p>
                        <p className="text-xs text-gray-500">{pkg.credits} credits</p>
                      </button>
                    ))}
                  </div>

                  {/* Custom amount */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Custom Amount (min $5)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                      <input
                        type="number"
                        min="5"
                        value={customAmount}
                        onChange={(e) => { setCustomAmount(e.target.value); setSelectedPackage(null); }}
                        placeholder="Custom"
                        className="w-full pl-7 pr-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handlePurchaseCredits}
                    disabled={processing || (!selectedPackage && (!customAmount || parseInt(customAmount) < 5))}
                    className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CreditCard className="w-5 h-5" />
                    )}
                    {processing ? 'Opening checkout...' : `Purchase ${selectedPackage || customAmount || 0} Credits`}
                  </button>

                  <div className="flex items-center gap-2 justify-center text-xs text-gray-600">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Secured by Stripe. We never store your card details.</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">Get monthly credits with a subscription and save.</p>

                  {SUBSCRIPTION_PLANS.map(plan => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative w-full p-5 rounded-xl text-left transition-all ${
                        selectedPlan === plan.id
                          ? 'bg-purple-600/15 border-2 border-purple-500/50'
                          : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute -top-2 right-4 px-2 py-0.5 bg-purple-600 text-white text-[9px] font-bold rounded-full">
                          BEST VALUE
                        </span>
                      )}
                      <div className="flex items-baseline justify-between mb-3">
                        <div>
                          <p className="text-lg font-bold text-white">{plan.name}</p>
                          {plan.billed && <p className="text-xs text-gray-500">Billed ${plan.billed}/year</p>}
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-white">${plan.price}</span>
                          <span className="text-gray-400 text-sm">/{plan.interval}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {plan.features.map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs text-gray-300">
                            <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}

                  <button
                    onClick={handleSubscribe}
                    disabled={processing}
                    className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    {processing ? 'Opening checkout...' : 'Subscribe Now'}
                  </button>

                  <div className="flex items-center gap-2 justify-center text-xs text-gray-600">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Cancel anytime. Secured by Stripe.</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
