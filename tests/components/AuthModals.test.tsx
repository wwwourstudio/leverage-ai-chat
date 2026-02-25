// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthModals } from '@/components/AuthModals';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  X: () => <span data-testid="close-icon">X</span>,
}));

// Mock Supabase client
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithOAuth = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}));

const defaultProps = {
  showLoginModal: false,
  showSignupModal: false,
  setShowLoginModal: vi.fn(),
  setShowSignupModal: vi.fn(),
  setIsLoggedIn: vi.fn(),
  setUser: vi.fn(),
};

function renderAuthModals(overrides = {}) {
  const props = { ...defaultProps, ...overrides };
  // Reset mock functions for each render
  props.setShowLoginModal = vi.fn();
  props.setShowSignupModal = vi.fn();
  props.setIsLoggedIn = vi.fn();
  props.setUser = vi.fn();
  return { ...render(<AuthModals {...props} />), props };
}

describe('AuthModals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  describe('login modal visibility', () => {
    it('renders login modal when showLoginModal is true', () => {
      render(<AuthModals {...defaultProps} showLoginModal />);
      expect(screen.getByText('Welcome Back')).toBeTruthy();
    });

    it('does not render login modal when showLoginModal is false', () => {
      render(<AuthModals {...defaultProps} showLoginModal={false} />);
      expect(screen.queryByText('Welcome Back')).toBeNull();
    });

    it('shows sign-in description text', () => {
      render(<AuthModals {...defaultProps} showLoginModal />);
      expect(screen.getByText('Sign in to access your account')).toBeTruthy();
    });

    it('renders email and password fields in login modal', () => {
      render(<AuthModals {...defaultProps} showLoginModal />);
      expect(screen.getByPlaceholderText('your@email.com')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter password')).toBeTruthy();
    });

    it('renders Sign In button', () => {
      render(<AuthModals {...defaultProps} showLoginModal />);
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
    });

    it('renders Continue with Google button', () => {
      render(<AuthModals {...defaultProps} showLoginModal />);
      expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    });
  });

  describe('signup modal visibility', () => {
    it('renders signup modal when showSignupModal is true', () => {
      render(<AuthModals {...defaultProps} showSignupModal />);
      // The modal has both an h2 and button with this text — use the heading role
      expect(screen.getByRole('heading', { name: 'Create Account' })).toBeTruthy();
    });

    it('does not render signup modal when showSignupModal is false', () => {
      render(<AuthModals {...defaultProps} showSignupModal={false} />);
      expect(screen.queryByText('Create Account')).toBeNull();
    });

    it('shows signup description text', () => {
      render(<AuthModals {...defaultProps} showSignupModal />);
      expect(screen.getByText('Sign up to get started with Leverage AI')).toBeTruthy();
    });

    it('renders name, email and password fields in signup modal', () => {
      render(<AuthModals {...defaultProps} showSignupModal />);
      expect(screen.getByPlaceholderText('John Doe')).toBeTruthy();
      expect(screen.getByPlaceholderText('your@email.com')).toBeTruthy();
      expect(screen.getByPlaceholderText('Create a password')).toBeTruthy();
    });

    it('renders Create Account button', () => {
      render(<AuthModals {...defaultProps} showSignupModal />);
      expect(screen.getByRole('button', { name: 'Create Account' })).toBeTruthy();
    });
  });

  describe('login modal close behavior', () => {
    it('calls setShowLoginModal(false) when close button is clicked', () => {
      const setShowLoginModal = vi.fn();
      render(<AuthModals {...defaultProps} showLoginModal setShowLoginModal={setShowLoginModal} />);
      const closeButton = screen.getAllByRole('button').find(
        (b) => b.querySelector('[data-testid="close-icon"]')
      );
      fireEvent.click(closeButton!);
      expect(setShowLoginModal).toHaveBeenCalledWith(false);
    });

    it('calls setShowLoginModal(false) when backdrop is clicked', () => {
      const setShowLoginModal = vi.fn();
      render(<AuthModals {...defaultProps} showLoginModal setShowLoginModal={setShowLoginModal} />);
      // The backdrop is the outer fixed div
      const backdrop = document.querySelector('.fixed.inset-0');
      fireEvent.click(backdrop!);
      expect(setShowLoginModal).toHaveBeenCalledWith(false);
    });

    it('does not close modal when clicking inside the card', () => {
      const setShowLoginModal = vi.fn();
      render(<AuthModals {...defaultProps} showLoginModal setShowLoginModal={setShowLoginModal} />);
      // Click the inner modal content (stopPropagation)
      const modal = document.querySelector('.relative.w-full');
      fireEvent.click(modal!);
      expect(setShowLoginModal).not.toHaveBeenCalled();
    });
  });

  describe('signup modal close behavior', () => {
    it('calls setShowSignupModal(false) when close button is clicked', () => {
      const setShowSignupModal = vi.fn();
      render(<AuthModals {...defaultProps} showSignupModal setShowSignupModal={setShowSignupModal} />);
      const closeButton = screen.getAllByRole('button').find(
        (b) => b.querySelector('[data-testid="close-icon"]')
      );
      fireEvent.click(closeButton!);
      expect(setShowSignupModal).toHaveBeenCalledWith(false);
    });
  });

  describe('modal switching', () => {
    it('switches from login to signup when Sign up link is clicked', () => {
      const setShowLoginModal = vi.fn();
      const setShowSignupModal = vi.fn();
      render(
        <AuthModals
          {...defaultProps}
          showLoginModal
          setShowLoginModal={setShowLoginModal}
          setShowSignupModal={setShowSignupModal}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
      expect(setShowLoginModal).toHaveBeenCalledWith(false);
      expect(setShowSignupModal).toHaveBeenCalledWith(true);
    });

    it('switches from signup to login when Log in link is clicked', () => {
      const setShowLoginModal = vi.fn();
      const setShowSignupModal = vi.fn();
      render(
        <AuthModals
          {...defaultProps}
          showSignupModal
          setShowLoginModal={setShowLoginModal}
          setShowSignupModal={setShowSignupModal}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
      expect(setShowSignupModal).toHaveBeenCalledWith(false);
      expect(setShowLoginModal).toHaveBeenCalledWith(true);
    });
  });

  describe('login form validation', () => {
    it('shows alert when email is empty', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      render(<AuthModals {...defaultProps} showLoginModal />);
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Please enter email and password');
      });
    });

    it('shows alert when password is empty but email is filled', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      render(<AuthModals {...defaultProps} showLoginModal />);
      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'user@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Please enter email and password');
      });
    });
  });

  describe('login form submission', () => {
    it('calls supabase signInWithPassword with email and password', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            email: 'user@example.com',
            user_metadata: { full_name: 'Test User' },
          },
        },
        error: null,
      });

      const setIsLoggedIn = vi.fn();
      const setUser = vi.fn();
      const setShowLoginModal = vi.fn();

      render(
        <AuthModals
          {...defaultProps}
          showLoginModal
          setIsLoggedIn={setIsLoggedIn}
          setUser={setUser}
          setShowLoginModal={setShowLoginModal}
        />
      );

      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Enter password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: 'user@example.com',
          password: 'password123',
        });
        expect(setIsLoggedIn).toHaveBeenCalledWith(true);
        expect(setShowLoginModal).toHaveBeenCalledWith(false);
      });
    });

    it('shows alert on login error', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {},
        error: { message: 'Invalid credentials' },
      });
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(<AuthModals {...defaultProps} showLoginModal />);

      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Enter password'), {
        target: { value: 'wrong' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Invalid credentials');
      });
    });
  });

  describe('signup form validation', () => {
    it('shows alert when email is empty in signup form', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      render(<AuthModals {...defaultProps} showSignupModal />);
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Please enter email and password');
      });
    });
  });

  describe('signup form submission', () => {
    it('calls supabase signUp with email, password, and name', async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: { email: 'newuser@example.com' },
        },
        error: null,
      });

      const setIsLoggedIn = vi.fn();
      const setUser = vi.fn();
      const setShowSignupModal = vi.fn();

      render(
        <AuthModals
          {...defaultProps}
          showSignupModal
          setIsLoggedIn={setIsLoggedIn}
          setUser={setUser}
          setShowSignupModal={setShowSignupModal}
        />
      );

      fireEvent.change(screen.getByPlaceholderText('John Doe'), {
        target: { value: 'Jane Smith' },
      });
      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'newuser@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Create a password'), {
        target: { value: 'securepass' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'newuser@example.com',
          password: 'securepass',
          options: { data: { full_name: 'Jane Smith' } },
        });
        expect(setIsLoggedIn).toHaveBeenCalledWith(true);
        expect(setShowSignupModal).toHaveBeenCalledWith(false);
      });
    });
  });
});
