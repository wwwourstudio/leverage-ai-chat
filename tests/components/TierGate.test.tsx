// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TierGate } from '@/components/fantasy/shared/TierGate';
import type { SubscriptionTier, FantasyFeature } from '@/lib/fantasy/types';

// shadcn/ui components render as semantic HTML in jsdom — no mocking needed.

describe('TierGate', () => {
  describe('when user has feature access', () => {
    it('renders children for free tier with basic_projections feature', () => {
      render(
        <TierGate tier="free" requiredFeature="basic_projections">
          <div data-testid="protected-content">Secret Stats</div>
        </TierGate>
      );
      expect(screen.getByTestId('protected-content')).toBeTruthy();
      expect(screen.getByText('Secret Stats')).toBeTruthy();
    });

    it('renders children for core tier with draft_assistant_basic feature', () => {
      render(
        <TierGate tier="core" requiredFeature="draft_assistant_basic">
          <span data-testid="draft-tool">Draft Tool</span>
        </TierGate>
      );
      expect(screen.getByTestId('draft-tool')).toBeTruthy();
    });

    it('renders children for pro tier with dfs_optimizer_basic feature', () => {
      render(
        <TierGate tier="pro" requiredFeature="dfs_optimizer_basic">
          <span data-testid="dfs-tool">DFS Optimizer</span>
        </TierGate>
      );
      expect(screen.getByTestId('dfs-tool')).toBeTruthy();
    });

    it('renders children for high_stakes tier with hedge_fund_mode feature', () => {
      render(
        <TierGate tier="high_stakes" requiredFeature="hedge_fund_mode">
          <div data-testid="hedge-content">Hedge Fund Mode</div>
        </TierGate>
      );
      expect(screen.getByTestId('hedge-content')).toBeTruthy();
    });

    it('does not show upgrade prompt when user has access', () => {
      render(
        <TierGate tier="pro" requiredFeature="dfs_optimizer_basic">
          <div>Content</div>
        </TierGate>
      );
      expect(screen.queryByText(/Upgrade/i)).toBeNull();
    });
  });

  describe('when user lacks feature access', () => {
    it('does not render children when access is denied', () => {
      render(
        <TierGate tier="free" requiredFeature="draft_assistant_basic">
          <div data-testid="protected-content">Secret Content</div>
        </TierGate>
      );
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });

    it('shows upgrade card when free tier tries to access core feature', () => {
      render(
        <TierGate tier="free" requiredFeature="draft_assistant_basic">
          <div>Hidden</div>
        </TierGate>
      );
      expect(screen.getByRole('button', { name: /Upgrade/i })).toBeTruthy();
    });

    it('shows the minimum required tier in the upgrade message', () => {
      render(
        <TierGate tier="free" requiredFeature="draft_assistant_basic">
          <div>Hidden</div>
        </TierGate>
      );
      // draft_assistant_basic requires core — "Core ($49/mo)" appears in both
      // the description <p> and the upgrade <button>, so use getAllByText
      const matches = screen.getAllByText(/Core \(\$49\/mo\)/i);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('shows high_stakes tier label for high_stakes-only features', () => {
      render(
        <TierGate tier="pro" requiredFeature="hedge_fund_mode">
          <div>Hidden</div>
        </TierGate>
      );
      // "High Stakes" appears in both <p> and <button>
      const matches = screen.getAllByText(/High Stakes/i);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('shows default "Premium Feature" label when featureLabel is not provided', () => {
      render(
        <TierGate tier="free" requiredFeature="draft_simulation" />
      );
      expect(screen.getByText('Premium Feature')).toBeTruthy();
    });

    it('shows custom featureLabel when provided', () => {
      render(
        <TierGate
          tier="free"
          requiredFeature="draft_simulation"
          featureLabel="AI Draft Simulator"
        />
      );
      expect(screen.getByText('AI Draft Simulator')).toBeTruthy();
      expect(screen.queryByText('Premium Feature')).toBeNull();
    });

    it('shows lock icon placeholder', () => {
      render(
        <TierGate tier="free" requiredFeature="draft_assistant_basic">
          <div>Hidden</div>
        </TierGate>
      );
      // The lock emoji is rendered as &#128274; (🔒)
      const button = screen.getByRole('button', { name: /Upgrade/i });
      expect(button.closest('[class*="border-dashed"]')).toBeTruthy();
    });

    it('shows tier-gated upgrade button text', () => {
      render(
        <TierGate tier="core" requiredFeature="dfs_optimizer_basic">
          <div>Hidden</div>
        </TierGate>
      );
      // dfs_optimizer_basic requires pro
      expect(screen.getByRole('button', { name: /Upgrade/i })).toBeTruthy();
    });
  });

  describe('tier hierarchy', () => {
    it('core can access free features', () => {
      render(
        <TierGate tier="core" requiredFeature="basic_projections">
          <div data-testid="content">Content</div>
        </TierGate>
      );
      expect(screen.getByTestId('content')).toBeTruthy();
    });

    it('pro can access pro-tier features', () => {
      // waiver_rankings_full is the pro equivalent (not waiver_rankings_basic)
      render(
        <TierGate tier="pro" requiredFeature="waiver_rankings_full">
          <div data-testid="content">Content</div>
        </TierGate>
      );
      expect(screen.getByTestId('content')).toBeTruthy();
    });

    it('high_stakes can access pro features', () => {
      render(
        <TierGate tier="high_stakes" requiredFeature="draft_simulation">
          <div data-testid="content">Content</div>
        </TierGate>
      );
      expect(screen.getByTestId('content')).toBeTruthy();
    });
  });
});
