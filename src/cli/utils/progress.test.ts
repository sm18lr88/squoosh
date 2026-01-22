/**
 * Tests for progress utilities
 */

import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatPercent,
  formatSizeDiff,
  createProgressReporter,
  createSimpleSpinner,
  createSpinner,
} from './progress.js';

describe('formatBytes', () => {
  it('should format 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('should format bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatBytes(10240)).toBe('10.0 KB');
    expect(formatBytes(102400)).toBe('100 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(5242880)).toBe('5.00 MB');
    expect(formatBytes(52428800)).toBe('50.0 MB');
    expect(formatBytes(524288000)).toBe('500 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.00 GB');
  });

  it('should handle negative values', () => {
    expect(formatBytes(-1024)).toBe('-1.00 KB');
    expect(formatBytes(-1048576)).toBe('-1.00 MB');
  });

  it('should handle very large values', () => {
    expect(formatBytes(1099511627776)).toBe('1.00 TB');
    expect(formatBytes(1125899906842624)).toBe('1.00 PB');
  });
});

describe('formatPercent', () => {
  it('should format percentage', () => {
    expect(formatPercent(50, 100)).toBe('50.0%');
    expect(formatPercent(25, 100)).toBe('25.0%');
    expect(formatPercent(75, 100)).toBe('75.0%');
  });

  it('should handle zero total', () => {
    expect(formatPercent(50, 0)).toBe('0%');
  });

  it('should handle full percentage', () => {
    expect(formatPercent(100, 100)).toBe('100.0%');
  });

  it('should handle decimal percentages', () => {
    expect(formatPercent(1, 3)).toBe('33.3%');
    expect(formatPercent(2, 3)).toBe('66.7%');
  });
});

describe('formatSizeDiff', () => {
  it('should format size reduction', () => {
    const result = formatSizeDiff(1000, 500);
    expect(result).toContain('-500 B');
    expect(result).toContain('-50.0%');
  });

  it('should format size increase', () => {
    const result = formatSizeDiff(500, 1000);
    expect(result).toContain('+500 B');
    expect(result).toContain('+100.0%');
  });

  it('should format no change', () => {
    const result = formatSizeDiff(1000, 1000);
    expect(result).toContain('0 B');
    expect(result).toContain('0.0%');
  });

  it('should handle larger sizes', () => {
    const result = formatSizeDiff(1048576, 524288);
    expect(result).toContain('-512 KB');
    expect(result).toContain('-50.0%');
  });
});

describe('createSpinner', () => {
  it('should create a spinner with text', () => {
    const spinner = createSpinner('Loading...');
    expect(spinner).toBeDefined();
    expect(spinner.text).toBe('Loading...');
  });
});

describe('createProgressReporter', () => {
  it('should create a progress reporter', () => {
    const reporter = createProgressReporter('Test');

    expect(reporter).toBeDefined();
    expect(typeof reporter.start).toBe('function');
    expect(typeof reporter.update).toBe('function');
    expect(typeof reporter.succeed).toBe('function');
    expect(typeof reporter.fail).toBe('function');
    expect(typeof reporter.stop).toBe('function');
  });

  it('should start and update progress', () => {
    const reporter = createProgressReporter('Processing');

    reporter.start(10);
    reporter.update(5, 'file.jpg');
    reporter.succeed('Done!');

    // No errors should be thrown
  });

  it('should handle update without start', () => {
    const reporter = createProgressReporter('Test');

    // Should not throw even without calling start
    reporter.update(1);
  });

  it('should handle stop after start', () => {
    const reporter = createProgressReporter('Test');

    reporter.start(5);
    reporter.stop();

    // Should not throw
  });

  it('should handle fail after start', () => {
    const reporter = createProgressReporter('Test');

    reporter.start(5);
    reporter.fail('Error occurred');

    // Should not throw
  });
});

describe('createSimpleSpinner', () => {
  it('should create a simple spinner', () => {
    const spinner = createSimpleSpinner('Loading...');

    expect(spinner).toBeDefined();
    expect(typeof spinner.start).toBe('function');
    expect(typeof spinner.succeed).toBe('function');
    expect(typeof spinner.fail).toBe('function');
    expect(typeof spinner.stop).toBe('function');
    expect(typeof spinner.update).toBe('function');
  });

  it('should allow updating text', () => {
    const spinner = createSimpleSpinner('Loading...');

    spinner.start();
    spinner.update('Almost done...');
    spinner.succeed('Complete!');

    // No errors should be thrown
  });
});
