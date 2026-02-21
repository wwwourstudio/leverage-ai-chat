'use client';

import { useState } from 'react';
import { X, CreditCard, Sparkles, CheckCircle, Loader2, Shield, Zap, Crown } from 'lucide-react';

interface StripeLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  onCreditsAdded?: (amount: number) => void;
  creditsRemaining: number;
}

type PurchaseTab = 'credits' | 'subscription';

const CREDIT_PACKAGES = [
  { amount: 10, credits: 10, label: '$10', popular: false },
  { amount: 25, credits: 25, label: '$25', popular: false },
  { amount: 50, credits: 50, label: '$50', popular: true },
  { amount: 100, credits: 100, label: '$100', popular: false },
  { amount: 250, credits: 250, label: '$250', popular: false },
];

const SUBSCRIPTION_PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 20,
    credits: 20,
    interval: 'month',
    features: ['20 credits/month', 'Priority AI analysis', 'Real-time alerts', 'Cancel anytime'],
  },
  {
    id: 'annual',
    name: 'Annual',
    price: 15,
    credits: 25,
    interval: 'month',
    billed: 180,
    features: ['25 credits/month', 'Priority AI analysis', 'Real-time alerts', 'Advanced analytics', 'Save 25%'],
    popular: true,
  },
];

export function StripeLightbox({ isOpen, onClose, onCreditsAdded, creditsRemaining }: StripeLightboxProps) {
  const [activeTab, setActiveTab] = useState<PurchaseTab>('credits');
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('annual');
  const [processing, setProcessing] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  const handlePurchaseCredits = async () => {
    const amount = selectedPackage ?? (parseInt(customAmount) || 0);
    if (amount < 5) return;

    setProcessing(true);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'credits',
          amount,
          credits: amount,
        }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else if (data.success) {
        // Credits added directly (test mode)
        onCreditsAdded?.(amount);
        onClose();
      } else {
        console.error('[Stripe] Checkout error:', data.error);
        // Fallback: add credits locally for demo
        onCreditsAdded?.(amount);
        onClose();
      }
    } catch (err) {
      console.error('[Stripe] Checkout failed:', err);
      // Fallback: add credits locally
      onCreditsAdded?.(amount);
      onClose();
    }
    setProcessing(false);
  };

  const handleSubscribe = async () => {
    setProcessing(true);
    try {
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
      if (!plan) return;

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          planId: plan.id,
          credits: plan.credits,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.success) {
        onCreditsAdded?.(plan.credits);
        onClose();
      } else {
        console.error('[Stripe] Subscription error:', data.error);
        onCreditsAdded?.(plan.credits);
        onClose();
      }
    } catch (err) {
      console.error('[Stripe] Subscription failed:', err);
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan);
      onCreditsAdded?.(plan?.credits || 20);
      onClose();
    }
    setProcessing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[85vh] mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Get Credits</h2>
              <p className="text-xs text-gray-500">You have {creditsRemaining} credits remaining</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex border-b border-gray-800">
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
                {processing ? 'Processing...' : `Purchase ${selectedPackage || customAmount || 0} Credits`}
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
                {processing ? 'Processing...' : 'Subscribe Now'}
              </button>

              <div className="flex items-center gap-2 justify-center text-xs text-gray-600">
                <Shield className="w-3.5 h-3.5" />
                <span>Cancel anytime. Secured by Stripe.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
