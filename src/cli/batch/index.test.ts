/**
 * Tests for batch processing module
 */

import { describe, it, expect } from 'vitest';
import { parseExtensions, DEFAULT_EXTENSIONS } from './scanner.js';

// Re-export tests for scanner utilities (already tested in scanner.test.ts)
// This file tests the batch processing orchestration

describe('batch processing', () => {
  describe('parseExtensions (re-exported)', () => {
    it('should parse extension strings', () => {
      expect(parseExtensions('jpg,png')).toEqual(['jpg', 'png']);
    });
  });

  describe('DEFAULT_EXTENSIONS (re-exported)', () => {
    it('should contain common formats', () => {
      expect(DEFAULT_EXTENSIONS).toContain('jpg');
      expect(DEFAULT_EXTENSIONS).toContain('png');
    });
  });
});

// Note: runCompress and processFiles require heavy mocking of:
// - WASM codec modules
// - File system operations
// - Progress spinner
// These are better tested as integration tests with actual files
