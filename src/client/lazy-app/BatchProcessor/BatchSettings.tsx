import { h, Component } from 'preact';

import * as style from './style.css';
import { cleanMerge } from '../util/clean-modify';
import {
  EncoderOptions,
  EncoderState,
  EncoderType,
  ProcessorState,
  ProcessorOptions,
  encoderMap,
  defaultProcessorState,
} from '../feature-meta';
import Toggle from '../Compress/Options/Toggle';
import Select from '../Compress/Options/Select';
import Expander from '../Compress/Options/Expander';
import { Options as QuantOptionsComponent } from 'features/processors/quantize/client';
import { Options as ResizeOptionsComponent } from 'features/processors/resize/client';
import { supportsFileSystemAccess } from '../util/fs-access';

interface Props {
  encoderState: EncoderState;
  processorState: ProcessorState;
  replaceOriginals: boolean;
  hasFileHandles: boolean;
  isProcessing: boolean;
  fileCount: number;
  useSharpServer: boolean;
  sharpServerVersion?: string;
  onEncoderTypeChange: (type: EncoderType) => void;
  onEncoderOptionsChange: (options: EncoderOptions) => void;
  onProcessorStateChange: (state: ProcessorState) => void;
  onReplaceOriginalsChange: (replace: boolean) => void;
  onStart: () => void;
  onDownloadAll: () => void;
}

interface State {
  supportedEncoderMap?: PartialButNotUndefined<typeof encoderMap>;
}

type PartialButNotUndefined<T> = {
  [P in keyof T]: T[P];
};

const supportedEncoderMapP: Promise<PartialButNotUndefined<typeof encoderMap>> = (async () => {
  const supportedEncoderMap: PartialButNotUndefined<typeof encoderMap> = {
    ...encoderMap,
  };

  await Promise.all(
    Object.entries(encoderMap).map(async ([encoderName, details]) => {
      if ('featureTest' in details && !(await details.featureTest())) {
        delete supportedEncoderMap[encoderName as keyof typeof encoderMap];
      }
    }),
  );

  return supportedEncoderMap;
})();

export default class BatchSettings extends Component<Props, State> {
  state: State = {
    supportedEncoderMap: undefined,
  };

  constructor() {
    super();
    supportedEncoderMapP.then((supportedEncoderMap) =>
      this.setState({ supportedEncoderMap }),
    );
  }

  private onEncoderTypeChange = (event: Event) => {
    const el = event.currentTarget as HTMLSelectElement;
    const type = el.value as EncoderType;
    this.props.onEncoderTypeChange(type);
  };

  private onProcessorEnabledChange = (event: Event) => {
    const el = event.currentTarget as HTMLInputElement;
    const processor = el.name.split('.')[0] as keyof ProcessorState;

    const newState = {
      ...this.props.processorState,
      [processor]: {
        ...this.props.processorState[processor],
        enabled: el.checked,
      },
    };
    this.props.onProcessorStateChange(newState);
  };

  private onQuantizerOptionsChange = (opts: ProcessorOptions['quantize']) => {
    this.props.onProcessorStateChange(
      cleanMerge(this.props.processorState, 'quantize', opts),
    );
  };

  private onResizeOptionsChange = (opts: ProcessorOptions['resize']) => {
    this.props.onProcessorStateChange(
      cleanMerge(this.props.processorState, 'resize', opts),
    );
  };

  private onEncoderOptionsChange = (newOptions: EncoderOptions) => {
    this.props.onEncoderOptionsChange(newOptions);
  };

  private onReplaceOriginalsChange = (event: Event) => {
    const el = event.currentTarget as HTMLInputElement;
    this.props.onReplaceOriginalsChange(el.checked);
  };

  render(
    {
      encoderState,
      processorState,
      replaceOriginals,
      hasFileHandles,
      isProcessing,
      fileCount,
      useSharpServer,
      sharpServerVersion,
      onStart,
      onDownloadAll,
    }: Props,
    { supportedEncoderMap }: State,
  ) {
    const encoder = encoderMap[encoderState.type];
    const EncoderOptionComponent =
      'Options' in encoder ? encoder.Options : undefined;
    const canReplace = supportsFileSystemAccess() && hasFileHandles;

    return (
      <div class={style.settingsPanel}>
        <div class={style.settingsHeader}>
          <h2 class={style.settingsTitle}>Batch Settings</h2>
          <span class={style.fileCountBadge}>{fileCount} files</span>
        </div>

        {useSharpServer && (
          <div class={style.serverIndicator}>
            <svg viewBox="0 0 24 24" class={style.serverIcon}>
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>
              Sharp Server{' '}
              {sharpServerVersion ? `v${sharpServerVersion}` : ''}
            </span>
          </div>
        )}

        <div class={style.settingsContent}>
          <section class={style.settingsSection}>
            <h3 class={style.sectionTitle}>Output Format</h3>
            {supportedEncoderMap ? (
              <Select
                value={encoderState.type}
                onChange={this.onEncoderTypeChange}
                large
              >
                {Object.entries(supportedEncoderMap).map(([type, enc]) => (
                  <option value={type}>{enc.meta.label}</option>
                ))}
              </Select>
            ) : (
              <Select large>
                <option>Loading...</option>
              </Select>
            )}
          </section>

          <Expander>
            {EncoderOptionComponent && (
              <section class={style.settingsSection}>
                <h3 class={style.sectionTitle}>Encoder Options</h3>
                <EncoderOptionComponent
                  options={encoderState.options as any}
                  onChange={this.onEncoderOptionsChange}
                />
              </section>
            )}
          </Expander>

          <section class={style.settingsSection}>
            <label class={style.toggleRow}>
              <span>Resize</span>
              <Toggle
                name="resize.enable"
                checked={!!processorState.resize.enabled}
                onChange={this.onProcessorEnabledChange}
              />
            </label>
            <Expander>
              {processorState.resize.enabled ? (
                <ResizeOptionsComponent
                  isVector={false}
                  inputWidth={1920}
                  inputHeight={1080}
                  options={processorState.resize}
                  onChange={this.onResizeOptionsChange}
                />
              ) : null}
            </Expander>
          </section>

          <section class={style.settingsSection}>
            <label class={style.toggleRow}>
              <span>Reduce Palette</span>
              <Toggle
                name="quantize.enable"
                checked={!!processorState.quantize.enabled}
                onChange={this.onProcessorEnabledChange}
              />
            </label>
            <Expander>
              {processorState.quantize.enabled ? (
                <QuantOptionsComponent
                  options={processorState.quantize}
                  onChange={this.onQuantizerOptionsChange}
                />
              ) : null}
            </Expander>
          </section>

          {canReplace && (
            <section class={style.settingsSection}>
              <label class={style.toggleRow}>
                <span class={style.replaceLabel}>
                  Auto-Save to Original Location
                  <span class={replaceOriginals ? style.replaceEnabled : style.replaceWarning}>
                    {replaceOriginals ? (
                      'Files will be saved automatically'
                    ) : (
                      'Files will NOT be overwritten'
                    )}
                  </span>
                </span>
                <Toggle
                  name="replaceOriginals"
                  checked={replaceOriginals}
                  onChange={this.onReplaceOriginalsChange}
                />
              </label>
            </section>
          )}
        </div>

        <div class={style.settingsActions}>
          <button
            class={style.primaryButton}
            onClick={onStart}
            disabled={isProcessing || fileCount === 0}
          >
            <svg viewBox="0 0 24 24" class={style.buttonIcon}>
              <path d="M8 5v14l11-7z" />
            </svg>
            {(() => {
              if (isProcessing) return 'Processing...';
              if (canReplace && replaceOriginals) return 'Process & Save';
              return 'Start Processing';
            })()}
          </button>

          {!(canReplace && replaceOriginals) && (
            <button
              class={style.secondaryButton}
              onClick={onDownloadAll}
              disabled={isProcessing}
            >
              <svg viewBox="0 0 24 24" class={style.buttonIcon}>
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
              Download{' '}All{' '}as{' '}ZIP
            </button>
          )}
        </div>
      </div>
    );
  }
}
