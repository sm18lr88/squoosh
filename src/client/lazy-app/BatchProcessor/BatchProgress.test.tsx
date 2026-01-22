/**
 * @vitest-environment happy-dom
 */

/**
 * Tests for BatchProgress component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import BatchProgress from './BatchProgress';

// Mock the CSS module
vi.mock('./style.css', () => ({
  progressContainer: 'progressContainer',
  progressBar: 'progressBar',
  progressFill: 'progressFill',
  progressStats: 'progressStats',
  progressStat: 'progressStat',
  statLabel: 'statLabel',
  statValue: 'statValue',
  progressActions: 'progressActions',
  actionButton: 'actionButton',
  actionIcon: 'actionIcon',
  cancelButton: 'cancelButton',
}));

describe('BatchProgress', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const defaultProps = {
    completed: 0,
    total: 10,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    averageSavings: 0,
    isProcessing: false,
    isPaused: false,
    onPause: vi.fn(),
    onResume: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders without crashing', () => {
    expect(() => {
      render(<BatchProgress {...defaultProps} />, container);
    }).not.toThrow();
  });

  it('displays file count correctly', () => {
    render(<BatchProgress {...defaultProps} completed={3} total={10} />, container);

    const statValues = container.querySelectorAll('.statValue');
    // First stat should be the file count
    expect(statValues[0]?.textContent).toContain('3');
    expect(statValues[0]?.textContent).toContain('10');
  });

  it('calculates and displays progress bar width correctly', () => {
    render(<BatchProgress {...defaultProps} completed={5} total={10} />, container);

    const progressFill = container.querySelector('.progressFill') as HTMLElement;
    expect(progressFill).toBeTruthy();
    expect(progressFill.style.width).toBe('50%');
  });

  it('shows 0% progress when total is 0', () => {
    render(<BatchProgress {...defaultProps} completed={0} total={0} />, container);

    const progressFill = container.querySelector('.progressFill') as HTMLElement;
    expect(progressFill).toBeTruthy();
    expect(progressFill.style.width).toBe('0%');
  });

  it('shows statistics when completed > 0', () => {
    render(
      <BatchProgress
        {...defaultProps}
        completed={5}
        total={10}
        totalOriginalSize={1024 * 1024}
        totalCompressedSize={512 * 1024}
        averageSavings={50}
      />,
      container,
    );

    const statLabels = container.querySelectorAll('.statLabel');
    const labelTexts = Array.from(statLabels).map(el => el.textContent);

    // Should show Saved, Avg. Reduction, Original, Compressed stats
    expect(labelTexts).toContain('Saved');
    expect(labelTexts).toContain('Avg. Reduction');
    expect(labelTexts).toContain('Original');
    expect(labelTexts).toContain('Compressed');
  });

  it('does not show extended statistics when completed is 0', () => {
    render(<BatchProgress {...defaultProps} completed={0} total={10} />, container);

    const statLabels = container.querySelectorAll('.statLabel');
    const labelTexts = Array.from(statLabels).map(el => el.textContent);

    // Should only show Files stat
    expect(labelTexts).toContain('Files');
    expect(labelTexts).not.toContain('Saved');
    expect(labelTexts).not.toContain('Avg. Reduction');
  });

  it('shows Pause button when processing and not paused', () => {
    render(
      <BatchProgress {...defaultProps} isProcessing={true} isPaused={false} />,
      container,
    );

    const buttons = container.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map(el => el.textContent);

    expect(buttonTexts.some(text => text?.includes('Pause'))).toBe(true);
    expect(buttonTexts.some(text => text?.includes('Resume'))).toBe(false);
  });

  it('shows Resume button when processing and paused', () => {
    render(
      <BatchProgress {...defaultProps} isProcessing={true} isPaused={true} />,
      container,
    );

    const buttons = container.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map(el => el.textContent);

    expect(buttonTexts.some(text => text?.includes('Resume'))).toBe(true);
    expect(buttonTexts.some(text => text?.includes('Pause'))).toBe(false);
  });

  it('shows Cancel button when processing', () => {
    render(<BatchProgress {...defaultProps} isProcessing={true} />, container);

    const buttons = container.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map(el => el.textContent);

    expect(buttonTexts.some(text => text?.includes('Cancel'))).toBe(true);
  });

  it('does not show action buttons when not processing', () => {
    render(<BatchProgress {...defaultProps} isProcessing={false} />, container);

    const actionsContainer = container.querySelector('.progressActions');
    expect(actionsContainer).toBeFalsy();
  });

  it('calls onPause when Pause button is clicked', () => {
    const onPause = vi.fn();
    render(
      <BatchProgress
        {...defaultProps}
        isProcessing={true}
        isPaused={false}
        onPause={onPause}
      />,
      container,
    );

    const buttons = container.querySelectorAll('button');
    const pauseButton = Array.from(buttons).find(btn =>
      btn.textContent?.includes('Pause')
    );

    pauseButton?.click();
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('calls onResume when Resume button is clicked', () => {
    const onResume = vi.fn();
    render(
      <BatchProgress
        {...defaultProps}
        isProcessing={true}
        isPaused={true}
        onResume={onResume}
      />,
      container,
    );

    const buttons = container.querySelectorAll('button');
    const resumeButton = Array.from(buttons).find(btn =>
      btn.textContent?.includes('Resume')
    );

    resumeButton?.click();
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <BatchProgress
        {...defaultProps}
        isProcessing={true}
        onCancel={onCancel}
      />,
      container,
    );

    const buttons = container.querySelectorAll('button');
    const cancelButton = Array.from(buttons).find(btn =>
      btn.textContent?.includes('Cancel')
    );

    cancelButton?.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  describe('formatBytes helper', () => {
    it('formats bytes correctly for various sizes', () => {
      // Test via the component rendering
      render(
        <BatchProgress
          {...defaultProps}
          completed={1}
          totalOriginalSize={1536}
          totalCompressedSize={512}
        />,
        container,
      );

      // Check that the saved bytes are formatted (1536 - 512 = 1024 = 1 KB)
      const statValues = container.querySelectorAll('.statValue');
      const texts = Array.from(statValues).map(el => el.textContent);
      expect(texts.some(text => text?.includes('KB'))).toBe(true);
    });

    it('formats 0 bytes correctly', () => {
      render(
        <BatchProgress
          {...defaultProps}
          completed={1}
          totalOriginalSize={0}
          totalCompressedSize={0}
        />,
        container,
      );

      const statValues = container.querySelectorAll('.statValue');
      const texts = Array.from(statValues).map(el => el.textContent);
      expect(texts.some(text => text?.includes('0 B'))).toBe(true);
    });

    it('formats megabytes correctly', () => {
      render(
        <BatchProgress
          {...defaultProps}
          completed={1}
          totalOriginalSize={2 * 1024 * 1024}
          totalCompressedSize={1 * 1024 * 1024}
        />,
        container,
      );

      const statValues = container.querySelectorAll('.statValue');
      const texts = Array.from(statValues).map(el => el.textContent);
      expect(texts.some(text => text?.includes('MB'))).toBe(true);
    });
  });

  it('displays average savings percentage', () => {
    render(
      <BatchProgress
        {...defaultProps}
        completed={1}
        averageSavings={45.67}
      />,
      container,
    );

    const statValues = container.querySelectorAll('.statValue');
    const texts = Array.from(statValues).map(el => el.textContent);
    expect(texts.some(text => text?.includes('45.7%'))).toBe(true);
  });

  it('shows 100% progress when all files are completed', () => {
    render(<BatchProgress {...defaultProps} completed={10} total={10} />, container);

    const progressFill = container.querySelector('.progressFill') as HTMLElement;
    expect(progressFill.style.width).toBe('100%');
  });
});
