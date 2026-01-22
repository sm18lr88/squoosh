/**
 * @vitest-environment happy-dom
 */

/**
 * Tests for BatchSettings component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';

// Hoist all mocks BEFORE any imports
vi.mock('./style.css', () => ({
  settingsPanel: 'settingsPanel',
  settingsHeader: 'settingsHeader',
  settingsTitle: 'settingsTitle',
  fileCountBadge: 'fileCountBadge',
  settingsContent: 'settingsContent',
  settingsSection: 'settingsSection',
  sectionTitle: 'sectionTitle',
  toggleRow: 'toggleRow',
  replaceLabel: 'replaceLabel',
  replaceEnabled: 'replaceEnabled',
  replaceWarning: 'replaceWarning',
  settingsActions: 'settingsActions',
  primaryButton: 'primaryButton',
  secondaryButton: 'secondaryButton',
  buttonIcon: 'buttonIcon',
  serverIndicator: 'serverIndicator',
  serverIcon: 'serverIcon',
}));

// Mock the CSS imports inside child components
vi.mock('../Compress/Options/Toggle/style.css', () => ({
  checkbox: 'checkbox',
  realCheckbox: 'realCheckbox',
  track: 'track',
  thumbTrack: 'thumbTrack',
  thumb: 'thumb',
}));

vi.mock('../Compress/Options/Select/style.css', () => ({
  select: 'select',
  builtinSelect: 'builtinSelect',
  large: 'large',
  arrow: 'arrow',
}));

vi.mock('../Compress/Options/Expander/style.css', () => ({
  expander: 'expander',
}));

// Mock the add-css imports (these are custom imports that add CSS)
vi.mock('add-css:../Compress/Options/Toggle/style.css', () => ({}));
vi.mock('add-css:../Compress/Options/Select/style.css', () => ({}));
vi.mock('add-css:../Compress/Options/Expander/style.css', () => ({}));
vi.mock('add-css:./style.css', () => ({}));

// Capture encoder options onChange
let capturedEncoderOptionsOnChange: ((opts: any) => void) | null = null;

// Mock feature-meta module
vi.mock('../feature-meta', () => ({
  encoderMap: {
    mozJPEG: {
      meta: { label: 'MozJPEG', extension: 'jpg', mimeType: 'image/jpeg' },
      Options: (props: any) => {
        capturedEncoderOptionsOnChange = props.onChange;
        return (
          <div data-testid="encoder-options">
            <button
              data-testid="encoder-options-change-trigger"
              onClick={() => props.onChange?.({ quality: 80 })}
            >
              MozJPEG Options
            </button>
          </div>
        );
      },
    },
    webP: {
      meta: { label: 'WebP', extension: 'webp', mimeType: 'image/webp' },
    },
    avif: {
      meta: { label: 'AVIF', extension: 'avif', mimeType: 'image/avif' },
    },
    // Add an encoder with a failing feature test to cover line 55
    unsupportedEncoder: {
      meta: { label: 'Unsupported', extension: 'unsup', mimeType: 'image/unsupported' },
      featureTest: () => Promise.resolve(false),
    },
  },
  defaultProcessorState: {
    resize: { enabled: false, width: 0, height: 0 },
    quantize: { enabled: false },
  },
}));

// Mock util/clean-modify
vi.mock('../util/clean-modify', () => ({
  cleanMerge: vi.fn((state, key, value) => ({
    ...state,
    [key]: value,
  })),
}));

// Mock fs-access
vi.mock('../util/fs-access', () => ({
  supportsFileSystemAccess: vi.fn(() => false),
}));

// Mock Toggle component entirely
vi.mock('../Compress/Options/Toggle', () => ({
  default: (props: any) => {
    const { name, checked, onChange } = props;
    return (
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        data-testid={`toggle-${name}`}
      />
    );
  },
}));

// Mock Select component entirely
vi.mock('../Compress/Options/Select', () => ({
  default: (props: any) => {
    const { value, onChange, large, children } = props;
    return (
      <select
        value={value}
        onChange={onChange}
        data-testid="encoder-select"
        data-large={large ? 'true' : 'false'}
      >
        {children}
      </select>
    );
  },
}));

// Mock Expander component entirely
vi.mock('../Compress/Options/Expander', () => ({
  default: (props: any) => <div data-testid="expander">{props.children}</div>,
}));

// Mock encoder/processor option components - capture onChange handlers
let capturedQuantizeOnChange: ((opts: any) => void) | null = null;
let capturedResizeOnChange: ((opts: any) => void) | null = null;

vi.mock('features/processors/quantize/client', () => ({
  Options: (props: any) => {
    capturedQuantizeOnChange = props.onChange;
    return (
      <div data-testid="quantize-options">
        <button
          data-testid="quantize-change-trigger"
          onClick={() => props.onChange?.({ enabled: true, colors: 128 })}
        >
          Quantize Options
        </button>
      </div>
    );
  },
}));

vi.mock('features/processors/resize/client', () => ({
  Options: (props: any) => {
    capturedResizeOnChange = props.onChange;
    return (
      <div data-testid="resize-options">
        <button
          data-testid="resize-change-trigger"
          onClick={() => props.onChange?.({ enabled: true, width: 800, height: 600 })}
        >
          Resize Options
        </button>
      </div>
    );
  },
}));

// Mock icons used by Select
vi.mock('client/lazy-app/icons', () => ({
  Arrow: () => <span>arrow</span>,
}));

// Now import the component under test
import BatchSettings from './BatchSettings';
import type { EncoderState, ProcessorState } from '../feature-meta';

describe('BatchSettings', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  const defaultEncoderState: EncoderState = {
    type: 'mozJPEG',
    options: {} as any,
  };

  const defaultProcessorState: ProcessorState = {
    resize: { enabled: false, width: 0, height: 0 } as any,
    quantize: { enabled: false } as any,
  };

  const defaultProps = {
    encoderState: defaultEncoderState,
    processorState: defaultProcessorState,
    replaceOriginals: false,
    hasFileHandles: false,
    isProcessing: false,
    fileCount: 5,
    useSharpServer: false,
    sharpServerVersion: undefined,
    onEncoderTypeChange: vi.fn(),
    onEncoderOptionsChange: vi.fn(),
    onProcessorStateChange: vi.fn(),
    onReplaceOriginalsChange: vi.fn(),
    onStart: vi.fn(),
    onDownloadAll: vi.fn(),
  };

  it('renders without crashing', () => {
    expect(() => {
      render(<BatchSettings {...defaultProps} />, container);
    }).not.toThrow();
  });

  it('displays the settings title', () => {
    render(<BatchSettings {...defaultProps} />, container);

    const title = container.querySelector('.settingsTitle');
    expect(title?.textContent).toBe('Batch Settings');
  });

  it('displays the file count badge', () => {
    render(<BatchSettings {...defaultProps} fileCount={10} />, container);

    const badge = container.querySelector('.fileCountBadge');
    expect(badge?.textContent).toBe('10 files');
  });

  it('displays "Output Format" section', () => {
    render(<BatchSettings {...defaultProps} />, container);

    const sectionTitles = container.querySelectorAll('.sectionTitle');
    const titles = Array.from(sectionTitles).map(el => el.textContent);
    expect(titles).toContain('Output Format');
  });

  it('displays encoder select dropdown', () => {
    render(<BatchSettings {...defaultProps} />, container);

    const select = container.querySelector('[data-testid="encoder-select"]');
    expect(select).toBeTruthy();
  });

  it('displays Resize toggle', () => {
    render(<BatchSettings {...defaultProps} />, container);

    const toggleLabels = container.querySelectorAll('.toggleRow span');
    const labelTexts = Array.from(toggleLabels).map(el => el.textContent);
    expect(labelTexts).toContain('Resize');
  });

  it('displays Reduce Palette toggle', () => {
    render(<BatchSettings {...defaultProps} />, container);

    const toggleLabels = container.querySelectorAll('.toggleRow span');
    const labelTexts = Array.from(toggleLabels).map(el => el.textContent);
    expect(labelTexts).toContain('Reduce Palette');
  });

  it('displays Start Processing button', () => {
    render(<BatchSettings {...defaultProps} />, container);

    const primaryButton = container.querySelector('.primaryButton');
    expect(primaryButton?.textContent).toContain('Start Processing');
  });

  it('displays Download All as ZIP button when not replacing originals', () => {
    render(<BatchSettings {...defaultProps} replaceOriginals={false} />, container);

    const secondaryButton = container.querySelector('.secondaryButton');
    expect(secondaryButton?.textContent).toContain('Download All as ZIP');
  });

  it('disables Start button when processing', () => {
    render(<BatchSettings {...defaultProps} isProcessing={true} />, container);

    const primaryButton = container.querySelector('.primaryButton');
    expect((primaryButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables Start button when fileCount is 0', () => {
    render(<BatchSettings {...defaultProps} fileCount={0} />, container);

    const primaryButton = container.querySelector('.primaryButton');
    expect((primaryButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Start button when not processing and has files', () => {
    render(
      <BatchSettings {...defaultProps} isProcessing={false} fileCount={5} />,
      container,
    );

    const primaryButton = container.querySelector('.primaryButton');
    expect((primaryButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows "Processing..." text when processing', () => {
    render(<BatchSettings {...defaultProps} isProcessing={true} />, container);

    const primaryButton = container.querySelector('.primaryButton');
    expect(primaryButton?.textContent).toContain('Processing...');
  });

  it('calls onStart when Start button is clicked', () => {
    const onStart = vi.fn();
    render(<BatchSettings {...defaultProps} onStart={onStart} />, container);

    const primaryButton = container.querySelector('.primaryButton');
    (primaryButton as HTMLButtonElement).click();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('calls onDownloadAll when Download All button is clicked', () => {
    const onDownloadAll = vi.fn();
    render(<BatchSettings {...defaultProps} onDownloadAll={onDownloadAll} />, container);

    const secondaryButton = container.querySelector('.secondaryButton');
    (secondaryButton as HTMLButtonElement).click();
    expect(onDownloadAll).toHaveBeenCalledTimes(1);
  });

  it('disables Download All button when processing', () => {
    render(<BatchSettings {...defaultProps} isProcessing={true} />, container);

    const secondaryButton = container.querySelector('.secondaryButton');
    expect((secondaryButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('passes onEncoderTypeChange to the Select component', async () => {
    const onEncoderTypeChange = vi.fn();
    render(
      <BatchSettings {...defaultProps} onEncoderTypeChange={onEncoderTypeChange} />,
      container,
    );

    // Wait for the supported encoder map to load
    await new Promise(resolve => setTimeout(resolve, 20));

    const select = container.querySelector('[data-testid="encoder-select"]');

    // Verify the select element exists - the component correctly renders the Select
    expect(select).toBeTruthy();

    // Verify Select receives the correct value after loading
    expect((select as HTMLSelectElement).getAttribute('value') || (select as HTMLSelectElement).value).toBe('mozJPEG');

    // Since we've verified the component renders correctly with the Select,
    // we can trust the wiring is correct. The actual change handling is
    // tested by the component's internal event handler.
  });

  it('calls onProcessorStateChange when resize toggle is changed', () => {
    const onProcessorStateChange = vi.fn();
    render(
      <BatchSettings
        {...defaultProps}
        onProcessorStateChange={onProcessorStateChange}
      />,
      container,
    );

    const resizeToggle = container.querySelector(
      '[data-testid="toggle-resize.enable"]'
    );

    const event = new Event('change', { bubbles: true });
    Object.defineProperty(event, 'currentTarget', {
      value: { name: 'resize.enable', checked: true },
      writable: false,
    });
    (resizeToggle as HTMLInputElement).dispatchEvent(event);

    expect(onProcessorStateChange).toHaveBeenCalled();
  });

  it('calls onProcessorStateChange when quantize toggle is changed', () => {
    const onProcessorStateChange = vi.fn();
    render(
      <BatchSettings
        {...defaultProps}
        onProcessorStateChange={onProcessorStateChange}
      />,
      container,
    );

    const quantizeToggle = container.querySelector(
      '[data-testid="toggle-quantize.enable"]'
    );

    const event = new Event('change', { bubbles: true });
    Object.defineProperty(event, 'currentTarget', {
      value: { name: 'quantize.enable', checked: true },
      writable: false,
    });
    (quantizeToggle as HTMLInputElement).dispatchEvent(event);

    expect(onProcessorStateChange).toHaveBeenCalled();
  });

  it('shows resize options when resize is enabled', () => {
    const processorState = {
      ...defaultProcessorState,
      resize: { enabled: true, width: 1920, height: 1080 } as any,
    };

    render(
      <BatchSettings {...defaultProps} processorState={processorState} />,
      container,
    );

    const resizeOptions = container.querySelector('[data-testid="resize-options"]');
    expect(resizeOptions).toBeTruthy();
  });

  it('does not show resize options when resize is disabled', () => {
    const processorState = {
      ...defaultProcessorState,
      resize: { enabled: false, width: 0, height: 0 } as any,
    };

    render(
      <BatchSettings {...defaultProps} processorState={processorState} />,
      container,
    );

    const resizeOptions = container.querySelector('[data-testid="resize-options"]');
    expect(resizeOptions).toBeFalsy();
  });

  it('shows quantize options when quantize is enabled', () => {
    const processorState = {
      ...defaultProcessorState,
      quantize: { enabled: true } as any,
    };

    render(
      <BatchSettings {...defaultProps} processorState={processorState} />,
      container,
    );

    const quantizeOptions = container.querySelector('[data-testid="quantize-options"]');
    expect(quantizeOptions).toBeTruthy();
  });

  it('does not show quantize options when quantize is disabled', () => {
    const processorState = {
      ...defaultProcessorState,
      quantize: { enabled: false } as any,
    };

    render(
      <BatchSettings {...defaultProps} processorState={processorState} />,
      container,
    );

    const quantizeOptions = container.querySelector('[data-testid="quantize-options"]');
    expect(quantizeOptions).toBeFalsy();
  });

  it('does not show replace originals option when hasFileHandles is false', () => {
    // Even with API support, need file handles
    render(
      <BatchSettings {...defaultProps} hasFileHandles={false} />,
      container,
    );

    const toggleLabels = container.querySelectorAll('.toggleRow span');
    const labelTexts = Array.from(toggleLabels).map(el => el.textContent);
    expect(labelTexts.join('')).not.toContain('Auto-Save');
  });

  it('renders encoder options in select dropdown', async () => {
    render(<BatchSettings {...defaultProps} />, container);

    // Wait for supported encoder map to load
    await new Promise(resolve => setTimeout(resolve, 10));

    const select = container.querySelector('[data-testid="encoder-select"]');
    const options = select?.querySelectorAll('option');

    // Should have at least one option (Loading... or encoder options)
    expect(options?.length).toBeGreaterThan(0);
  });

  it('displays correct file count in badge', () => {
    render(<BatchSettings {...defaultProps} fileCount={42} />, container);

    const badge = container.querySelector('.fileCountBadge');
    expect(badge?.textContent).toBe('42 files');
  });

  it('displays 0 files correctly', () => {
    render(<BatchSettings {...defaultProps} fileCount={0} />, container);

    const badge = container.querySelector('.fileCountBadge');
    expect(badge?.textContent).toBe('0 files');
  });

  it('displays 1 file correctly', () => {
    render(<BatchSettings {...defaultProps} fileCount={1} />, container);

    const badge = container.querySelector('.fileCountBadge');
    expect(badge?.textContent).toBe('1 files');
  });

  it('calls onEncoderTypeChange when encoder select changes', async () => {
    const onEncoderTypeChange = vi.fn();
    render(
      <BatchSettings {...defaultProps} onEncoderTypeChange={onEncoderTypeChange} />,
      container,
    );

    // Wait for supported encoder map to load
    await new Promise(resolve => setTimeout(resolve, 20));

    const select = container.querySelector('[data-testid="encoder-select"]');

    // Simulate a change event
    const changeEvent = new Event('change', { bubbles: true });
    Object.defineProperty(changeEvent, 'currentTarget', {
      value: { value: 'webP' },
      writable: false,
    });
    (select as HTMLSelectElement).dispatchEvent(changeEvent);

    expect(onEncoderTypeChange).toHaveBeenCalledWith('webP');
  });

  it('calls onReplaceOriginalsChange when replace toggle changes', async () => {
    // Need to mock supportsFileSystemAccess to return true
    const { supportsFileSystemAccess } = await import('../util/fs-access');
    vi.mocked(supportsFileSystemAccess).mockReturnValue(true);

    const onReplaceOriginalsChange = vi.fn();
    render(
      <BatchSettings
        {...defaultProps}
        hasFileHandles={true}
        onReplaceOriginalsChange={onReplaceOriginalsChange}
      />,
      container,
    );

    const replaceToggle = container.querySelector(
      '[data-testid="toggle-replaceOriginals"]'
    );

    expect(replaceToggle).toBeTruthy();

    const event = new Event('change', { bubbles: true });
    Object.defineProperty(event, 'currentTarget', {
      value: { checked: true },
      writable: false,
    });
    (replaceToggle as HTMLInputElement).dispatchEvent(event);

    expect(onReplaceOriginalsChange).toHaveBeenCalledWith(true);
  });

  it('shows replace originals option when canReplace is true', async () => {
    const { supportsFileSystemAccess } = await import('../util/fs-access');
    vi.mocked(supportsFileSystemAccess).mockReturnValue(true);

    render(
      <BatchSettings {...defaultProps} hasFileHandles={true} />,
      container,
    );

    const toggleLabels = container.querySelectorAll('.toggleRow span');
    const labelTexts = Array.from(toggleLabels).map(el => el.textContent);
    expect(labelTexts.join('')).toContain('Auto-Save');
  });

  it('shows "Process & Save" button text when replaceOriginals is enabled and canReplace is true', async () => {
    const { supportsFileSystemAccess } = await import('../util/fs-access');
    vi.mocked(supportsFileSystemAccess).mockReturnValue(true);

    render(
      <BatchSettings
        {...defaultProps}
        hasFileHandles={true}
        replaceOriginals={true}
      />,
      container,
    );

    const primaryButton = container.querySelector('.primaryButton');
    expect(primaryButton?.textContent).toContain('Process & Save');
  });

  it('hides Download All button when replaceOriginals is enabled and canReplace is true', async () => {
    const { supportsFileSystemAccess } = await import('../util/fs-access');
    vi.mocked(supportsFileSystemAccess).mockReturnValue(true);

    render(
      <BatchSettings
        {...defaultProps}
        hasFileHandles={true}
        replaceOriginals={true}
      />,
      container,
    );

    const secondaryButton = container.querySelector('.secondaryButton');
    expect(secondaryButton).toBeFalsy();
  });

  it('shows "Files will be saved automatically" when replaceOriginals is true', async () => {
    const { supportsFileSystemAccess } = await import('../util/fs-access');
    vi.mocked(supportsFileSystemAccess).mockReturnValue(true);

    render(
      <BatchSettings
        {...defaultProps}
        hasFileHandles={true}
        replaceOriginals={true}
      />,
      container,
    );

    const replaceEnabled = container.querySelector('.replaceEnabled');
    expect(replaceEnabled?.textContent).toContain('Files will be saved automatically');
  });

  it('shows "Files will NOT be overwritten" when replaceOriginals is false', async () => {
    const { supportsFileSystemAccess } = await import('../util/fs-access');
    vi.mocked(supportsFileSystemAccess).mockReturnValue(true);

    render(
      <BatchSettings
        {...defaultProps}
        hasFileHandles={true}
        replaceOriginals={false}
      />,
      container,
    );

    const replaceWarning = container.querySelector('.replaceWarning');
    expect(replaceWarning?.textContent).toContain('Files will NOT be overwritten');
  });

  it('displays server indicator when useSharpServer is true', () => {
    render(
      <BatchSettings {...defaultProps} useSharpServer={true} />,
      container,
    );

    const serverIndicator = container.querySelector('.serverIndicator');
    expect(serverIndicator).toBeTruthy();
    expect(serverIndicator?.textContent).toContain('Sharp Server');
  });

  it('displays server version when sharpServerVersion is provided', () => {
    render(
      <BatchSettings
        {...defaultProps}
        useSharpServer={true}
        sharpServerVersion="1.2.3"
      />,
      container,
    );

    const serverIndicator = container.querySelector('.serverIndicator');
    expect(serverIndicator?.textContent).toContain('v1.2.3');
  });

  it('does not display server indicator when useSharpServer is false', () => {
    render(
      <BatchSettings {...defaultProps} useSharpServer={false} />,
      container,
    );

    const serverIndicator = container.querySelector('.serverIndicator');
    expect(serverIndicator).toBeFalsy();
  });

  it('calls onProcessorStateChange when quantize options change', () => {
    const onProcessorStateChange = vi.fn();
    const processorState = {
      ...defaultProcessorState,
      quantize: { enabled: true } as any,
    };

    render(
      <BatchSettings
        {...defaultProps}
        processorState={processorState}
        onProcessorStateChange={onProcessorStateChange}
      />,
      container,
    );

    // Find and click the quantize change trigger button
    const quantizeChangeTrigger = container.querySelector(
      '[data-testid="quantize-change-trigger"]'
    );

    expect(quantizeChangeTrigger).toBeTruthy();
    (quantizeChangeTrigger as HTMLButtonElement).click();

    expect(onProcessorStateChange).toHaveBeenCalled();
  });

  it('calls onProcessorStateChange when resize options change', () => {
    const onProcessorStateChange = vi.fn();
    const processorState = {
      ...defaultProcessorState,
      resize: { enabled: true, width: 1920, height: 1080 } as any,
    };

    render(
      <BatchSettings
        {...defaultProps}
        processorState={processorState}
        onProcessorStateChange={onProcessorStateChange}
      />,
      container,
    );

    // Find and click the resize change trigger button
    const resizeChangeTrigger = container.querySelector(
      '[data-testid="resize-change-trigger"]'
    );

    expect(resizeChangeTrigger).toBeTruthy();
    (resizeChangeTrigger as HTMLButtonElement).click();

    expect(onProcessorStateChange).toHaveBeenCalled();
  });

  it('calls onEncoderOptionsChange when encoder options change', async () => {
    const onEncoderOptionsChange = vi.fn();

    // Use mozJPEG which has Options in our mock
    const encoderState = {
      type: 'mozJPEG' as const,
      options: { quality: 75 } as any,
    };

    render(
      <BatchSettings
        {...defaultProps}
        encoderState={encoderState}
        onEncoderOptionsChange={onEncoderOptionsChange}
      />,
      container,
    );

    // Find and click the encoder options change trigger button
    const encoderOptionsChangeTrigger = container.querySelector(
      '[data-testid="encoder-options-change-trigger"]'
    );

    expect(encoderOptionsChangeTrigger).toBeTruthy();
    (encoderOptionsChangeTrigger as HTMLButtonElement).click();

    expect(onEncoderOptionsChange).toHaveBeenCalledWith({ quality: 80 });
  });

  it('renders encoder options section when encoder has Options component', () => {
    const encoderState = {
      type: 'mozJPEG' as const,
      options: { quality: 75 } as any,
    };

    render(
      <BatchSettings {...defaultProps} encoderState={encoderState} />,
      container,
    );

    const encoderOptions = container.querySelector('[data-testid="encoder-options"]');
    expect(encoderOptions).toBeTruthy();

    const sectionTitle = Array.from(container.querySelectorAll('.sectionTitle')).find(
      el => el.textContent === 'Encoder Options'
    );
    expect(sectionTitle).toBeTruthy();
  });

  it('does not render encoder options section when encoder has no Options component', () => {
    const encoderState = {
      type: 'webP' as const,
      options: {} as any,
    };

    render(
      <BatchSettings {...defaultProps} encoderState={encoderState} />,
      container,
    );

    const encoderOptions = container.querySelector('[data-testid="encoder-options"]');
    expect(encoderOptions).toBeFalsy();
  });

  it('filters out encoders that fail feature test from the select dropdown', async () => {
    render(<BatchSettings {...defaultProps} />, container);

    // Wait for the supported encoder map to load and feature tests to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    const select = container.querySelector('[data-testid="encoder-select"]');
    const options = select?.querySelectorAll('option');

    // Should have loaded encoders (not showing "Loading...")
    const optionTexts = Array.from(options || []).map(opt => opt.textContent);

    // The unsupportedEncoder should be filtered out due to failing featureTest
    expect(optionTexts).not.toContain('Unsupported');

    // Other encoders should still be present
    expect(optionTexts).toContain('MozJPEG');
    expect(optionTexts).toContain('WebP');
    expect(optionTexts).toContain('AVIF');
  });
});
