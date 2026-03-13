'use client';

import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AuthModalsProps {
  showLoginModal: boolean;
  showSignupModal: boolean;
  setShowLoginModal: (v: boolean) => void;
  setShowSignupModal: (v: boolean) => void;
  setIsLoggedIn: (v: boolean) => void;
  setUser: (v: { name: string; email: string } | null) => void;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

export function AuthModals({
  showLoginModal,
  showSignupModal,
  setShowLoginModal,
  setShowSignupModal,
  setIsLoggedIn,
  setUser,
}: AuthModalsProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  const handleLogin = async () => {
    setLoginError('');
    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter your email and password');
      return;
    }
    setLoginLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        setLoginError(error.message);
        return;
      }

      if (data.user) {
        setIsLoggedIn(true);
        setUser({
          name: data.user.user_metadata?.full_name || loginEmail.split('@')[0],
          email: data.user.email || loginEmail,
        });
        setLoginEmail('');
        setLoginPassword('');
        setShowLoginModal(false);
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async () => {
    setSignupError('');
    if (!signupEmail || !signupPassword) {
      setSignupError('Please enter your email and password');
      return;
    }
    setSignupLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: { data: { full_name: signupName } },
      });

      if (error) {
        setSignupError(error.message);
        return;
      }

      if (data.user) {
        setIsLoggedIn(true);
        setUser({ name: signupName || signupEmail.split('@')[0], email: signupEmail });
        setSignupName('');
        setSignupEmail('');
        setSignupPassword('');
        setShowSignupModal(false);
      }
    } catch (err: any) {
      setSignupError(err?.message || 'Signup failed. Please try again.');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    } catch (err: any) {
      setLoginError(err?.message || 'Google auth failed');
    }
  };

  return (
    <>
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-in"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="relative w-full md:max-w-md md:mx-4 bg-gray-900 border border-[var(--border-subtle)] rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up md:animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
                <p className="text-sm text-gray-400">Sign in to access your account</p>
              </div>

              <div className="space-y-4">
                {loginError && <ErrorBanner message={loginError} />}

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="Enter password"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <button
                  onClick={handleLogin}
                  disabled={loginLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                >
                  {loginLoading ? 'Signing in\u2026' : 'Sign In'}
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-800"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-900 text-gray-500">or</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleAuth}
                  className="w-full py-3 border border-gray-800 hover:bg-gray-800 text-white font-semibold rounded-xl transition-all"
                >
                  Continue with Google
                </button>

                <p className="text-center text-sm text-gray-500">
                  {"Don't have an account? "}
                  <button
                    onClick={() => {
                      setShowLoginModal(false);
                      setShowSignupModal(true);
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSignupModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-backdrop-in"
          onClick={() => setShowSignupModal(false)}
        >
          <div
            className="relative w-full md:max-w-md md:mx-4 bg-gray-900 border border-[var(--border-subtle)] rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up md:animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSignupModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Create Account</h2>
                <p className="text-sm text-gray-400">Sign up to get started with Leverage AI</p>
              </div>

              <div className="space-y-4">
                {signupError && <ErrorBanner message={signupError} />}

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Password</label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
                    placeholder="Create a password"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <button
                  onClick={handleSignup}
                  disabled={signupLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg"
                >
                  {signupLoading ? 'Creating account\u2026' : 'Create Account'}
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-800"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-900 text-gray-500">or</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleAuth}
                  className="w-full py-3 border border-gray-800 hover:bg-gray-800 text-white font-semibold rounded-xl transition-all"
                >
                  Sign up with Google
                </button>

                <p className="text-center text-sm text-gray-500">
                  {"Already have an account? "}
                  <button
                    onClick={() => {
                      setShowSignupModal(false);
                      setShowLoginModal(true);
                    }}
                    className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                  >
                    Log in
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
