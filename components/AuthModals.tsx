'use client';

import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AuthModalsProps {
  showLoginModal: boolean;
  showSignupModal: boolean;
  setShowLoginModal: (v: boolean) => void;
  setShowSignupModal: (v: boolean) => void;
  setIsLoggedIn: (v: boolean) => void;
  setUser: (v: { name: string; email: string } | null) => void;
}

export function AuthModals({
  showLoginModal,
  showSignupModal,
  setShowLoginModal,
  setShowSignupModal,
  setIsLoggedIn,
  setUser,
}: AuthModalsProps) {
  const handleLogin = async () => {
    const emailInput = document.getElementById('login-email') as HTMLInputElement;
    const email = emailInput?.value || '';
    const passwordInput = document.getElementById('login-password') as HTMLInputElement;
    const password = passwordInput?.value || '';

    if (!email || !password) {
      alert('Please enter email and password');
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        alert(error.message);
        return;
      }

      if (data.user) {
        setIsLoggedIn(true);
        setUser({
          name: data.user.user_metadata?.full_name || email.split('@')[0],
          email: data.user.email || email,
        });
        setShowLoginModal(false);
      }
    } catch (err: any) {
      alert(err.message || 'Login failed');
    }
  };

  const handleSignup = async () => {
    const nameInput = document.getElementById('signup-name') as HTMLInputElement;
    const emailInput = document.getElementById('signup-email') as HTMLInputElement;
    const passwordInput = document.getElementById('signup-password') as HTMLInputElement;
    const name = nameInput?.value || '';
    const email = emailInput?.value || '';
    const password = passwordInput?.value || '';

    if (!email || !password) {
      alert('Please enter email and password');
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });

      if (error) {
        alert(error.message);
        return;
      }

      if (data.user) {
        setIsLoggedIn(true);
        setUser({ name: name || email.split('@')[0], email });
        setShowSignupModal(false);
      }
    } catch (err: any) {
      alert(err.message || 'Signup failed');
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
    } catch (err: any) {
      alert(err.message || 'Google auth failed');
    }
  };

  return (
    <>
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl"
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
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Password</label>
                  <input
                    id="login-password"
                    type="password"
                    placeholder="Enter password"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <button
                  onClick={handleLogin}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all"
                >
                  Sign In
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowSignupModal(false)}
        >
          <div
            className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl"
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
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Full Name</label>
                  <input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Email</label>
                  <input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Password</label>
                  <input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <button
                  onClick={handleSignup}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg"
                >
                  Create Account
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
