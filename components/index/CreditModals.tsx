'use client';

import { X, AlertCircle, Sparkles, CheckCircle } from 'lucide-react';

interface Props {
  // Purchase modal
  showPurchase: boolean;
  purchaseAmount: string;
  setPurchaseAmount: (v: string) => void;
  onClosePurchase: () => void;
  onStripeCheckout: () => void;
  onLogin: () => void;
  // Subscription modal
  showSubscription: boolean;
  onCloseSubscription: () => void;
  onStripeSubscription: () => void;
}

/**
 * Inline credit purchase and subscription modals.
 * Both were previously defined inline in page-client.tsx.
 */
export function CreditModals({
  showPurchase,
  purchaseAmount,
  setPurchaseAmount,
  onClosePurchase,
  onStripeCheckout,
  onLogin,
  showSubscription,
  onCloseSubscription,
  onStripeSubscription,
}: Props) {
  return (
    <>
      {/* Purchase Credits Modal */}
      {showPurchase && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-in"
          onClick={onClosePurchase}
        >
          <div
            className="relative w-full md:max-w-md max-h-[90vh] md:mx-4 bg-gray-900 border border-[var(--border-subtle)] rounded-t-2xl md:rounded-2xl shadow-2xl animate-slide-up md:animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClosePurchase}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/30 mb-4">
                  <AlertCircle className="w-6 h-6 text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Out of Credits</h2>
                <p className="text-sm text-gray-400">Purchase more credits to continue using AI analysis</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Amount (min $10)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                    <input
                      type="number"
                      min="10"
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(e.target.value)}
                      placeholder="10"
                      className="w-full pl-8 pr-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[20, 50, 100, 250].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setPurchaseAmount(amount.toString())}
                      className="flex-1 min-w-[80px] px-4 py-2.5 rounded-xl border border-gray-800 bg-gray-950 hover:bg-gray-800 hover:border-gray-700 text-white font-semibold text-sm transition-all"
                    >
                      ${amount}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => { onClosePurchase(); onStripeCheckout(); }}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all"
                >
                  Purchase Credits
                </button>

                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <button
                    onClick={() => { onClosePurchase(); onStripeCheckout(); }}
                    className="text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                  >
                    View Subscription
                  </button>
                  <button
                    onClick={() => { onClosePurchase(); onLogin(); }}
                    className="text-sm text-gray-400 hover:text-gray-300 font-semibold transition-colors"
                  >
                    Login
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscription && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-in"
          onClick={onCloseSubscription}
        >
          <div
            className="relative w-full md:max-w-md max-h-[90vh] md:mx-4 bg-gray-900 border border-[var(--border-subtle)] rounded-t-2xl md:rounded-2xl shadow-2xl animate-slide-up md:animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onCloseSubscription}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/30 mb-4">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Monthly Subscription</h2>
                <p className="text-sm text-gray-400">Get 20 credits every month for continuous access</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-6 mb-6">
                <div className="flex items-baseline justify-center mb-4">
                  <span className="text-4xl font-black text-white">$20</span>
                  <span className="text-gray-400 ml-2">/month</span>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  {['20 credits per month', 'Auto-renews on the 1st', 'Cancel anytime', 'Priority support'].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { onCloseSubscription(); onStripeSubscription(); }}
                className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all mb-3"
              >
                Subscribe Now
              </button>

              <button
                onClick={() => { onCloseSubscription(); onStripeSubscription(); }}
                className="w-full py-3 text-sm text-gray-400 hover:text-gray-300 font-semibold transition-colors"
              >
                One-time purchase instead
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
