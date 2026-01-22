# Squoosh QA Test Plan

## Executive Summary

**Application**: Squoosh - Professional Image Compression Tool
**Version**: Current Development
**Test Plan Version**: 1.0
**Date**: 2026-01-21

Squoosh is a dual-interface image compression application featuring:
- **Web UI**: Interactive browser-based Preact SPA with real-time image comparison
- **CLI**: Command-line tool for batch processing and automation

This test plan covers comprehensive testing across both interfaces, all supported codecs, and critical user workflows.

---

## Test Scope

### In Scope

**CLI Application:**
- Single file compression with all supported formats
- Batch/directory processing with recursive scanning
- Interactive mode prompts and selection
- All encoder options and quality settings
- Output path calculation and file writing
- Backend selection (WASM, Sharp, Native CLI tools)
- Error handling and validation
- Cross-platform compatibility (Windows, macOS, Linux)

**Web UI Application:**
- Single image compression workflow
- Batch processing interface
- Image comparison (side-by-side, overlay)
- Format-specific option controls
- Preprocessing (rotate, resize, quantize)
- Download and export functionality
- Service worker and offline functionality
- Drag-and-drop file handling
- Share target integration

**Codec Coverage:**
- JPEG (MozJPEG, Browser JPEG)
- PNG (OxiPNG, Browser PNG)
- WebP
- AVIF
- JPEG XL (JXL)
- QOI
- WebP2 (WP2)
- GIF (Browser GIF)

### Out of Scope

- WASM codec internal implementation (external pre-built binaries)
- Build system and Rollup plugin testing
- Third-party dependency internals
- Performance benchmarking (separate effort)
- Accessibility compliance (separate audit)
- Security penetration testing (separate audit)

---

## Test Strategy

### Test Types

| Type | Coverage | Automation |
|------|----------|------------|
| Unit Tests | CLI utilities, codec registry, path calculation | Vitest |
| Integration Tests | Codec execution, file I/O, worker communication | Vitest + Manual |
| Component Tests | Web UI Preact components | Vitest + Testing Library |
| End-to-End Tests | Full user workflows | Playwright |
| Manual Tests | Visual quality, UX validation | Manual |
| Regression Tests | Critical paths after changes | Automated suite |

### Test Approach

- **Risk-Based**: Prioritize codec encoding/decoding accuracy
- **Boundary Testing**: Test quality ranges (0-100), file size limits
- **Equivalence Partitioning**: Group similar codec configurations
- **Error Path Testing**: Invalid inputs, missing files, unsupported formats

---

## Test Environment

### Required Platforms

| Platform | Browser/Runtime | Priority |
|----------|-----------------|----------|
| Windows 11 | Chrome 120+, Edge 120+ | High |
| macOS 14+ | Safari 17+, Chrome 120+ | High |
| Ubuntu 22.04+ | Firefox 120+, Chrome 120+ | Medium |
| Node.js 20 LTS | CLI execution | High |
| Node.js 22 | CLI execution | Medium |

### Test Data Requirements

**Sample Images:**
- Small (< 100KB): icons, thumbnails
- Medium (100KB - 1MB): typical photos
- Large (1MB - 10MB): high-resolution photos
- Very Large (> 10MB): RAW/uncompressed images

**Format Coverage:**
- Input: JPEG, PNG, WebP, AVIF, JXL, QOI, WP2, GIF, BMP
- Output: All supported encoder formats

**Edge Cases:**
- Transparent PNG/WebP images
- Animated GIF/WebP
- Images with EXIF metadata
- Grayscale images
- 16-bit color depth
- Very small dimensions (1x1, 10x10)
- Very large dimensions (10000x10000)

---

## Entry Criteria

- [ ] Code build completes without errors
- [ ] All WASM codecs compile successfully
- [ ] Test environment provisioned
- [ ] Test data prepared and available
- [ ] Previous critical bugs resolved

## Exit Criteria

- [ ] All P0 (Critical) test cases pass
- [ ] 95%+ P1 (High) test cases pass
- [ ] 90%+ overall test case pass rate
- [ ] No open Critical or High severity bugs
- [ ] Regression suite passes
- [ ] Cross-platform validation complete

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WASM codec fails on specific platform | Medium | High | Test all codecs on all platforms |
| Large file causes memory exhaustion | Medium | Medium | Test with various file sizes, set limits |
| Backend fallback logic incorrect | Low | High | Integration tests for backend selection |
| Output file corruption | Low | Critical | Verify output file integrity |
| Service worker cache invalidation fails | Medium | Medium | Test offline scenarios |
| Batch processing hangs | Medium | High | Add timeout tests, monitor worker pool |

---

# Test Cases

## 1. CLI - Core Compression

### TC-CLI-001: Single File JPEG Compression

**Priority:** P0 (Critical)
**Type:** Functional / Integration
**Estimated Time:** 3 minutes

#### Objective
Verify single JPEG file compression with default MozJPEG encoder

#### Preconditions
- Node.js 20+ installed
- Squoosh CLI installed/linked
- Sample JPEG image available (test.jpg, ~500KB)

#### Test Steps

1. Run compression command:
   ```bash
   squoosh compress test.jpg -f mozjpeg
   ```
   **Expected:** Command executes without error

2. Verify output file created:
   ```bash
   ls test.mozjpeg.jpg
   ```
   **Expected:** Output file exists with default suffix

3. Compare file sizes:
   **Expected:** Output file is smaller than input

4. Open output in image viewer:
   **Expected:** Image displays correctly without corruption

#### Test Data
- Input: test.jpg (500KB, 1920x1080, RGB)
- Quality: Default (75)

#### Post-conditions
- Output file created in same directory
- Original file unchanged

---

### TC-CLI-002: All Encoder Formats

**Priority:** P0 (Critical)
**Type:** Functional / Integration
**Estimated Time:** 10 minutes

#### Objective
Verify all supported encoders produce valid output

#### Test Matrix

| Format | Command | Expected Extension |
|--------|---------|-------------------|
| MozJPEG | `-f mozjpeg` | .mozjpeg.jpg |
| WebP | `-f webp` | .webp |
| AVIF | `-f avif` | .avif |
| JXL | `-f jxl` | .jxl |
| OxiPNG | `-f oxipng` | .oxipng.png |
| QOI | `-f qoi` | .qoi |
| WP2 | `-f wp2` | .wp2 |

#### Test Steps

1. For each format in matrix:
   ```bash
   squoosh compress test.png -f <format>
   ```
   **Expected:** Command succeeds

2. Verify output file exists and is non-zero size
   **Expected:** File created with correct extension

3. Verify output can be decoded back:
   **Expected:** Image is valid and can be opened

---

### TC-CLI-003: Quality Parameter Range

**Priority:** P1 (High)
**Type:** Boundary / Functional
**Estimated Time:** 5 minutes

#### Objective
Verify quality parameter accepts valid range and rejects invalid values

#### Test Steps

1. Test minimum quality (0):
   ```bash
   squoosh compress test.jpg -f mozjpeg -q 0
   ```
   **Expected:** Succeeds, smallest file size

2. Test maximum quality (100):
   ```bash
   squoosh compress test.jpg -f mozjpeg -q 100
   ```
   **Expected:** Succeeds, largest file size

3. Test mid-range quality (50):
   ```bash
   squoosh compress test.jpg -f mozjpeg -q 50
   ```
   **Expected:** Succeeds, file size between min/max

4. Test invalid quality (-1):
   ```bash
   squoosh compress test.jpg -f mozjpeg -q -1
   ```
   **Expected:** Error message, no output file

5. Test invalid quality (101):
   ```bash
   squoosh compress test.jpg -f mozjpeg -q 101
   ```
   **Expected:** Error message, no output file

6. Test non-numeric quality:
   ```bash
   squoosh compress test.jpg -f mozjpeg -q abc
   ```
   **Expected:** Error message, no output file

---

### TC-CLI-004: Batch Directory Processing

**Priority:** P0 (Critical)
**Type:** Functional / Integration
**Estimated Time:** 5 minutes

#### Objective
Verify batch processing of multiple images in a directory

#### Preconditions
- Directory with 5+ images (mixed JPEG/PNG)
- Output directory exists or can be created

#### Test Steps

1. Run batch compression:
   ```bash
   squoosh compress ./images/ -f webp -o ./output/
   ```
   **Expected:** All images processed

2. Verify output count matches input:
   ```bash
   ls ./output/*.webp | wc -l
   ```
   **Expected:** Same number of files as input

3. Verify each output is valid WebP:
   **Expected:** All files are valid images

4. Check progress output shows all files:
   **Expected:** Progress indicator for each file

---

### TC-CLI-005: Recursive Directory Scanning

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify recursive flag processes nested directories

#### Preconditions
- Directory structure with nested folders containing images

#### Test Steps

1. Run with recursive flag:
   ```bash
   squoosh compress ./images/ -f webp -r
   ```
   **Expected:** Images in subdirectories also processed

2. Verify output maintains directory structure:
   **Expected:** Output files in corresponding subdirectories

---

### TC-CLI-006: Extension Filtering

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify extension filter limits which files are processed

#### Preconditions
- Directory with mixed extensions (jpg, png, gif, webp)

#### Test Steps

1. Filter to JPEG only:
   ```bash
   squoosh compress ./images/ -f webp -e jpg,jpeg
   ```
   **Expected:** Only .jpg/.jpeg files processed

2. Filter to PNG only:
   ```bash
   squoosh compress ./images/ -f webp -e png
   ```
   **Expected:** Only .png files processed

3. Verify excluded files are not processed:
   **Expected:** No output for non-matching extensions

---

### TC-CLI-007: Output Suffix Customization

**Priority:** P2 (Medium)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify custom output suffix works correctly

#### Test Steps

1. Use custom suffix:
   ```bash
   squoosh compress test.jpg -f webp -s ".compressed"
   ```
   **Expected:** Output file is test.compressed.webp

2. Use empty suffix:
   ```bash
   squoosh compress test.jpg -f webp -s ""
   ```
   **Expected:** Output file is test.webp (overwrites if same format)

---

### TC-CLI-008: Backend Selection

**Priority:** P1 (High)
**Type:** Functional / Integration
**Estimated Time:** 5 minutes

#### Objective
Verify different backends produce valid output

#### Preconditions
- Sharp installed
- Optional: Native tools installed (cjxl, cwebp, avifenc)

#### Test Steps

1. Use Sharp backend (default):
   ```bash
   squoosh compress test.jpg -f webp --backend sharp
   ```
   **Expected:** Uses Sharp, output is valid

2. Use WASM backend:
   ```bash
   squoosh compress test.jpg -f webp --backend wasm
   ```
   **Expected:** Uses WASM, output is valid

3. Use native backend (if available):
   ```bash
   squoosh compress test.jpg -f jxl --backend native
   ```
   **Expected:** Uses native cjxl, output is valid

4. Test fallback when preferred backend unavailable:
   **Expected:** Falls back to next available backend

---

### TC-CLI-009: Input Format Detection

**Priority:** P0 (Critical)
**Type:** Functional
**Estimated Time:** 5 minutes

#### Objective
Verify all input formats are correctly detected and decoded

#### Test Matrix

| Input Format | File Extension | MIME Type |
|--------------|----------------|-----------|
| JPEG | .jpg, .jpeg | image/jpeg |
| PNG | .png | image/png |
| WebP | .webp | image/webp |
| AVIF | .avif | image/avif |
| JXL | .jxl | image/jxl |
| QOI | .qoi | image/qoi |
| GIF | .gif | image/gif |

#### Test Steps

1. For each input format:
   ```bash
   squoosh compress test.<ext> -f webp
   ```
   **Expected:** Format detected, decoded, and converted successfully

---

### TC-CLI-010: Error Handling - Invalid Input

**Priority:** P1 (High)
**Type:** Negative / Error Handling
**Estimated Time:** 3 minutes

#### Objective
Verify proper error handling for invalid inputs

#### Test Steps

1. Non-existent file:
   ```bash
   squoosh compress nonexistent.jpg -f webp
   ```
   **Expected:** Clear error message "File not found"

2. Invalid/corrupt image:
   ```bash
   squoosh compress corrupted.jpg -f webp
   ```
   **Expected:** Clear error message about decode failure

3. Unsupported format:
   ```bash
   squoosh compress document.pdf -f webp
   ```
   **Expected:** Clear error message about unsupported format

4. Invalid encoder name:
   ```bash
   squoosh compress test.jpg -f invalid
   ```
   **Expected:** Error listing available formats

---

## 2. CLI - Interactive Mode

### TC-CLI-INT-001: Interactive Format Selection

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify interactive mode prompts work correctly

#### Test Steps

1. Start interactive mode:
   ```bash
   squoosh compress test.jpg --interactive
   ```
   **Expected:** Prompt for format selection appears

2. Select format using arrow keys and Enter:
   **Expected:** Format selected, next prompt appears

3. Complete all prompts:
   **Expected:** Compression executes with selected options

---

## 3. Web UI - Single Image Compression

### TC-WEB-001: Image Upload via Drag-and-Drop

**Priority:** P0 (Critical)
**Type:** Functional / UI
**Estimated Time:** 3 minutes

#### Objective
Verify drag-and-drop image upload works correctly

#### Preconditions
- Squoosh web app loaded in browser
- Sample image file accessible

#### Test Steps

1. Navigate to squoosh.app (or local dev server)
   **Expected:** Landing page loads with drop zone visible

2. Drag image file over drop zone:
   **Expected:** Drop zone highlights, indicates ready to receive

3. Drop image file:
   **Expected:**
   - Image loads into editor
   - Original displayed on left
   - Compressed preview on right
   - File size comparison shown

4. Verify image dimensions shown:
   **Expected:** Width x Height displayed

---

### TC-WEB-002: Image Upload via File Picker

**Priority:** P0 (Critical)
**Type:** Functional / UI
**Estimated Time:** 2 minutes

#### Objective
Verify file picker upload works correctly

#### Test Steps

1. Click "Select an image" or browse button:
   **Expected:** System file picker opens

2. Select image file and confirm:
   **Expected:** Image loads into editor

3. Verify same behavior as drag-and-drop:
   **Expected:** Editor shows original and compressed preview

---

### TC-WEB-003: Format Selection and Options

**Priority:** P0 (Critical)
**Type:** Functional / UI
**Estimated Time:** 5 minutes

#### Objective
Verify format selection updates options panel correctly

#### Test Steps

1. Load image into editor
   **Expected:** Default format selected (MozJPEG)

2. Change format to WebP:
   **Expected:**
   - Options panel updates to WebP-specific controls
   - Preview updates with WebP compression

3. Change format to AVIF:
   **Expected:**
   - Options panel shows AVIF controls (effort, quality)
   - Preview updates

4. Change format to OxiPNG:
   **Expected:**
   - Options panel shows PNG controls (level, interlace)
   - Preview updates

5. Verify each format shows appropriate controls:
   | Format | Expected Controls |
   |--------|-------------------|
   | MozJPEG | Quality, Smoothing, Baseline, Progressive |
   | WebP | Quality, Lossless toggle, Method |
   | AVIF | Quality, Speed, Subsample |
   | OxiPNG | Level, Interlace |
   | JXL | Quality, Effort, Progressive |

---

### TC-WEB-004: Quality Slider Interaction

**Priority:** P1 (High)
**Type:** Functional / UI
**Estimated Time:** 3 minutes

#### Objective
Verify quality slider updates preview and file size

#### Test Steps

1. Load image with MozJPEG selected
   **Expected:** Quality slider visible, default value shown

2. Drag slider to minimum (leftmost):
   **Expected:**
   - File size decreases
   - Preview quality visibly lower
   - Size indicator updates

3. Drag slider to maximum (rightmost):
   **Expected:**
   - File size increases
   - Preview quality visibly higher
   - Size indicator updates

4. Type specific value in input field:
   **Expected:** Slider position updates, preview updates

---

### TC-WEB-005: Side-by-Side Comparison

**Priority:** P1 (High)
**Type:** Functional / UI
**Estimated Time:** 3 minutes

#### Objective
Verify side-by-side comparison interface works correctly

#### Test Steps

1. Load image into editor
   **Expected:** Two-up view shows original (left) and compressed (right)

2. Drag comparison slider:
   **Expected:** Divider moves, revealing more/less of each side

3. Zoom into image:
   **Expected:** Both sides zoom together, stay synchronized

4. Pan zoomed image:
   **Expected:** Both sides pan together

---

### TC-WEB-006: Download Compressed Image

**Priority:** P0 (Critical)
**Type:** Functional
**Estimated Time:** 2 minutes

#### Objective
Verify compressed image can be downloaded

#### Test Steps

1. Load and compress image
   **Expected:** Download button visible

2. Click download button:
   **Expected:**
   - Browser download dialog appears
   - File has correct extension for format
   - File size matches displayed size

3. Open downloaded file:
   **Expected:** Image displays correctly, not corrupted

---

### TC-WEB-007: Resize Preprocessor

**Priority:** P1 (High)
**Type:** Functional / UI
**Estimated Time:** 3 minutes

#### Objective
Verify image resize functionality works correctly

#### Test Steps

1. Load image and expand Resize section
   **Expected:** Resize controls visible (width, height, method)

2. Enable resize and set width to 800:
   **Expected:**
   - Height auto-calculates (maintain aspect ratio)
   - Preview updates with resized dimensions

3. Change resize method (Lanczos3):
   **Expected:** Preview updates with new algorithm

4. Download and verify dimensions:
   **Expected:** Output file is 800px wide

---

### TC-WEB-008: Color Quantization

**Priority:** P2 (Medium)
**Type:** Functional / UI
**Estimated Time:** 3 minutes

#### Objective
Verify color quantization (reduce colors) works correctly

#### Test Steps

1. Load PNG image and expand Reduce palette section
   **Expected:** Quantization controls visible

2. Enable and set colors to 256:
   **Expected:** Preview updates with reduced color palette

3. Set colors to 16:
   **Expected:** Visible color banding, smaller file size

4. Adjust dithering:
   **Expected:** Dithering pattern visible in preview

---

### TC-WEB-009: Rotation Preprocessor

**Priority:** P2 (Medium)
**Type:** Functional / UI
**Estimated Time:** 2 minutes

#### Objective
Verify image rotation works correctly

#### Test Steps

1. Load image with rotation controls visible
   **Expected:** Rotation options available

2. Rotate 90 degrees clockwise:
   **Expected:** Preview shows rotated image

3. Rotate 180 degrees:
   **Expected:** Image upside down

4. Download and verify rotation applied:
   **Expected:** Output file is rotated

---

### TC-WEB-010: Transparent Image Handling

**Priority:** P1 (High)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify transparent images are handled correctly

#### Preconditions
- PNG image with alpha channel (transparency)

#### Test Steps

1. Load transparent PNG:
   **Expected:** Transparency preserved in preview (checkerboard background)

2. Compress as WebP (lossless):
   **Expected:** Transparency preserved

3. Compress as AVIF:
   **Expected:** Transparency preserved

4. Compress as JPEG:
   **Expected:** Warning about losing transparency, or background color applied

---

## 4. Web UI - Batch Processing

### TC-WEB-BATCH-001: Add Multiple Files

**Priority:** P1 (High)
**Type:** Functional / UI
**Estimated Time:** 3 minutes

#### Objective
Verify batch mode accepts multiple files

#### Test Steps

1. Navigate to batch processing mode
   **Expected:** Batch interface visible

2. Drop multiple files (5+ images):
   **Expected:**
   - All files added to queue
   - File list shows all items
   - Total count displayed

3. Add more files incrementally:
   **Expected:** Files appended to existing queue

---

### TC-WEB-BATCH-002: Batch Compression Execution

**Priority:** P0 (Critical)
**Type:** Functional
**Estimated Time:** 5 minutes

#### Objective
Verify batch compression processes all files

#### Test Steps

1. Add 10 images to batch queue
   **Expected:** Queue shows 10 items

2. Select output format (WebP)
   **Expected:** Format selection applied to all

3. Start batch processing:
   **Expected:**
   - Progress indicator for each file
   - Overall progress shown
   - Files process in parallel (worker pool)

4. Wait for completion:
   **Expected:** All files show completed status

5. Download results:
   **Expected:** ZIP file or individual downloads available

---

### TC-WEB-BATCH-003: Batch Error Handling

**Priority:** P1 (High)
**Type:** Negative / Error Handling
**Estimated Time:** 3 minutes

#### Objective
Verify batch mode handles errors gracefully

#### Test Steps

1. Add mix of valid and invalid files to queue
   **Expected:** All files added

2. Start processing:
   **Expected:**
   - Valid files process successfully
   - Invalid files show error status
   - Processing continues for remaining files

3. Check error messages:
   **Expected:** Clear indication of which files failed and why

---

## 5. Web UI - Service Worker / Offline

### TC-WEB-SW-001: Offline Functionality

**Priority:** P2 (Medium)
**Type:** Functional
**Estimated Time:** 5 minutes

#### Objective
Verify application works offline after initial load

#### Test Steps

1. Load squoosh.app with network enabled
   **Expected:** App loads, service worker installs

2. Wait for "Ready for offline" notification (if shown)
   **Expected:** Service worker cached assets

3. Disable network (DevTools > Network > Offline)
   **Expected:** No immediate errors

4. Refresh page:
   **Expected:** App loads from cache

5. Load and compress an image:
   **Expected:** Compression works offline (WASM in cache)

---

### TC-WEB-SW-002: Cache Update

**Priority:** P2 (Medium)
**Type:** Functional
**Estimated Time:** 3 minutes

#### Objective
Verify service worker updates when new version available

#### Test Steps

1. Load app (current version cached)
   **Expected:** App runs from cache

2. Deploy new version (simulate with dev server)
   **Expected:** New service worker detected

3. Refresh page:
   **Expected:** Update notification or automatic update

4. Verify new version active:
   **Expected:** New features/fixes visible

---

## 6. Cross-Browser Compatibility

### TC-BROWSER-001: Chrome Compatibility

**Priority:** P0 (Critical)
**Type:** Compatibility
**Estimated Time:** 10 minutes

#### Objective
Verify full functionality in Chrome 120+

#### Test Steps
- Execute TC-WEB-001 through TC-WEB-010 in Chrome
- All should pass with no browser-specific issues

---

### TC-BROWSER-002: Firefox Compatibility

**Priority:** P1 (High)
**Type:** Compatibility
**Estimated Time:** 10 minutes

#### Objective
Verify full functionality in Firefox 120+

#### Test Steps
- Execute TC-WEB-001 through TC-WEB-010 in Firefox
- Note any browser-specific differences

---

### TC-BROWSER-003: Safari Compatibility

**Priority:** P1 (High)
**Type:** Compatibility
**Estimated Time:** 10 minutes

#### Objective
Verify full functionality in Safari 17+

#### Test Steps
- Execute TC-WEB-001 through TC-WEB-010 in Safari
- Pay attention to WASM and Worker support

---

### TC-BROWSER-004: Edge Compatibility

**Priority:** P2 (Medium)
**Type:** Compatibility
**Estimated Time:** 10 minutes

#### Objective
Verify full functionality in Edge 120+

#### Test Steps
- Execute TC-WEB-001 through TC-WEB-010 in Edge
- Should behave same as Chrome (Chromium-based)

---

## 7. Performance and Edge Cases

### TC-PERF-001: Large File Handling

**Priority:** P1 (High)
**Type:** Performance / Stress
**Estimated Time:** 5 minutes

#### Objective
Verify application handles large files without crashing

#### Test Steps

1. Load 10MB+ image file:
   **Expected:**
   - Loading indicator shown
   - No browser freeze
   - Image eventually loads

2. Compress large image:
   **Expected:**
   - Progress indicator
   - Memory usage reasonable
   - Compression completes

3. CLI batch with 100+ large files:
   **Expected:**
   - Processes without memory exhaustion
   - Progress tracking accurate

---

### TC-PERF-002: Very Small Images

**Priority:** P2 (Medium)
**Type:** Edge Case
**Estimated Time:** 3 minutes

#### Objective
Verify handling of very small images

#### Test Steps

1. Load 1x1 pixel image:
   **Expected:** Loads without error

2. Load 10x10 pixel image:
   **Expected:** Compresses normally

3. Verify output is valid:
   **Expected:** Output files are valid images

---

### TC-PERF-003: Concurrent Operations

**Priority:** P1 (High)
**Type:** Performance / Stress
**Estimated Time:** 5 minutes

#### Objective
Verify multiple concurrent compressions work correctly

#### Test Steps

1. Start batch processing 20 files
2. While processing, add 10 more files
3. Verify all complete successfully
4. No race conditions or corruption

---

## 8. Image Quality Validation

### TC-QUALITY-001: Visual Quality Consistency

**Priority:** P1 (High)
**Type:** Quality Assurance
**Estimated Time:** 10 minutes

#### Objective
Verify output quality matches expectations for quality settings

#### Test Steps

1. Compress test image at quality 25, 50, 75, 100
2. Visually inspect each output
3. Verify quality degradation is progressive
4. Compare file sizes are proportional

#### Expected Quality Levels
- Q25: Visible artifacts, significant size reduction
- Q50: Minor artifacts, moderate size reduction
- Q75: Near-original quality, good compression
- Q100: Lossless or near-lossless

---

### TC-QUALITY-002: Format Comparison

**Priority:** P2 (Medium)
**Type:** Quality Assurance
**Estimated Time:** 10 minutes

#### Objective
Compare quality/size tradeoffs across formats

#### Test Steps

1. Compress same image with all formats at similar quality
2. Document file sizes
3. Visually compare quality
4. Verify AVIF/JXL achieve best size/quality ratio

---

# Regression Test Suite

## Smoke Tests (15 minutes)

Execute before each release:

| ID | Test Case | Priority |
|----|-----------|----------|
| SMOKE-001 | TC-CLI-001 - Single JPEG Compression | P0 |
| SMOKE-002 | TC-CLI-004 - Batch Processing | P0 |
| SMOKE-003 | TC-WEB-001 - Drag-and-Drop Upload | P0 |
| SMOKE-004 | TC-WEB-003 - Format Selection | P0 |
| SMOKE-005 | TC-WEB-006 - Download Image | P0 |
| SMOKE-006 | TC-CLI-009 - Input Format Detection | P0 |

## Full Regression (2-4 hours)

Execute before major releases:

- All P0 test cases
- All P1 test cases
- Selected P2 test cases
- Cross-browser validation
- Performance tests

---

# Bug Report Template

When reporting issues found during testing:

```markdown
## BUG-[ID]: [Clear, specific title]

**Severity:** Critical | High | Medium | Low
**Priority:** P0 | P1 | P2 | P3
**Component:** CLI | Web UI | Codec | Build
**Found In:** [Version/Commit]

### Environment
- OS: [Windows 11, macOS 14, Ubuntu 22.04]
- Browser: [Chrome 120, Firefox 121, Safari 17]
- Node.js: [v20.x, v22.x]

### Steps to Reproduce
1. [Specific step]
2. [Specific step]
3. [Specific step]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Evidence
- Screenshot: [attached]
- Console errors: [paste]
- Sample file: [attached]

### Additional Context
- Related test case: TC-XXX-XXX
- Regression: Yes/No
```

---

# Appendix

## A. Test Data Catalog

| File Name | Dimensions | Size | Format | Purpose |
|-----------|------------|------|--------|---------|
| test-small.jpg | 640x480 | 50KB | JPEG | Basic tests |
| test-medium.jpg | 1920x1080 | 500KB | JPEG | Standard tests |
| test-large.jpg | 4000x3000 | 5MB | JPEG | Large file tests |
| test-transparent.png | 800x600 | 200KB | PNG | Transparency tests |
| test-animated.gif | 400x300 | 1MB | GIF | Animation tests |
| test-exif.jpg | 1920x1080 | 600KB | JPEG | Metadata tests |
| test-16bit.png | 1000x1000 | 2MB | PNG | Color depth tests |

## B. Codec Option Ranges

| Codec | Option | Min | Max | Default |
|-------|--------|-----|-----|---------|
| MozJPEG | quality | 0 | 100 | 75 |
| MozJPEG | smoothing | 0 | 100 | 0 |
| WebP | quality | 0 | 100 | 75 |
| WebP | method | 0 | 6 | 4 |
| AVIF | quality | 0 | 100 | 50 |
| AVIF | speed | 0 | 10 | 6 |
| JXL | quality | 0 | 100 | 75 |
| JXL | effort | 1 | 9 | 7 |
| OxiPNG | level | 0 | 6 | 2 |

## C. Coverage Tracking

| Area | Test Cases | Status |
|------|------------|--------|
| CLI Core | 10 | Defined |
| CLI Interactive | 1 | Defined |
| Web UI Single | 10 | Defined |
| Web UI Batch | 3 | Defined |
| Service Worker | 2 | Defined |
| Cross-Browser | 4 | Defined |
| Performance | 3 | Defined |
| Quality | 2 | Defined |
| **Total** | **35** | - |

---

*Test Plan Generated: 2026-01-21*
*Next Review Date: Before next major release*
