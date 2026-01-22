import { h, Component } from 'preact';
import type { FileDropEvent } from 'file-drop-element';

import * as style from './style.css';
import 'add-css:./style.css';

import BatchQueue, { BatchItem } from './BatchQueue';
import BatchFileList from './BatchFileList';
import BatchSettings from './BatchSettings';
import BatchProgress from './BatchProgress';
import {
  EncoderState,
  EncoderType,
  EncoderOptions,
  ProcessorState,
  encoderMap,
  defaultProcessorState,
} from '../feature-meta';
import type { FileWithHandle } from '../util/fs-access';
import {
  supportsFileSystemAccess,
  openFilesWithHandles,
  filesFromFileList,
} from '../util/fs-access';
import type SnackBarElement from 'shared/custom-els/snack-bar';

/**
 * Supported image file extensions (lowercase, without dot)
 */
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'jxl',
  'svg', 'bmp', 'ico', 'qoi', 'tiff', 'tif',
]);

/**
 * Check if a file is a supported image type
 * Uses both MIME type and file extension for robust detection
 */
function isSupportedImageFile(file: File): boolean {
  // Check MIME type first (most reliable)
  if (file.type?.startsWith('image/')) {
    return true;
  }

  // Fall back to extension check for files without MIME type
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension && SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return true;
  }

  return false;
}

/**
 * Filter files to only include supported image types
 * Returns the filtered files and the count of skipped files
 */
function filterImageFiles(files: FileWithHandle[]): {
  imageFiles: FileWithHandle[];
  skippedCount: number;
} {
  const imageFiles: FileWithHandle[] = [];
  let skippedCount = 0;

  for (const fileWithHandle of files) {
    if (isSupportedImageFile(fileWithHandle.file)) {
      imageFiles.push(fileWithHandle);
    } else {
      skippedCount++;
    }
  }

  return { imageFiles, skippedCount };
}

interface Props {
  files: FileWithHandle[];
  showSnack: SnackBarElement['showSnackbar'];
  onBack: () => void;
}

interface State {
  items: BatchItem[];
  encoderState: EncoderState;
  processorState: ProcessorState;
  replaceOriginals: boolean;
  autoSaveEnabled: boolean;
  isProcessing: boolean;
  isPaused: boolean;
  completed: number;
  total: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  averageSavings: number;
  useSharpServer: boolean;
  sharpServerVersion?: string;
}

export default class BatchProcessor extends Component<Props, State> {
  private readonly batchQueue: BatchQueue;
  private fileInputRef?: HTMLInputElement;

  state: State = {
    items: [],
    encoderState: {
      type: 'mozJPEG',
      options: encoderMap.mozJPEG.meta.defaultOptions,
    },
    processorState: defaultProcessorState,
    replaceOriginals: false,
    autoSaveEnabled: false,
    isProcessing: false,
    isPaused: false,
    completed: 0,
    total: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    averageSavings: 0,
    useSharpServer: false,
    sharpServerVersion: undefined,
  };

  private readonly initialSkippedCount: number = 0;

  constructor(props: Props) {
    super(props);

    this.batchQueue = new BatchQueue({
      onItemUpdate: this.onItemUpdate,
      onProgress: this.onProgress,
    });

    // Add initial files (filtered)
    if (props.files.length > 0) {
      const { imageFiles, skippedCount } = filterImageFiles(props.files);
      this.initialSkippedCount = skippedCount;
      if (imageFiles.length > 0) {
        this.batchQueue.addFiles(imageFiles);
      }
    }
  }

  componentDidMount() {
    const items = this.batchQueue.getItems();
    const hasHandles = items.some((item) => item.fileHandle !== undefined);

    // Auto-enable "Replace Originals" when file handles are available
    // This makes the experience seamless for PWA/Chrome users
    this.setState({
      items,
      total: this.batchQueue.totalCount,
      replaceOriginals: hasHandles,
      autoSaveEnabled: hasHandles,
    });

    // Check Sharp server status (it checks asynchronously in constructor)
    // Re-check and update state after a brief delay
    globalThis.setTimeout(async () => {
      const serverStatus = await this.batchQueue.recheckSharpServer();
      this.setState({
        useSharpServer: serverStatus.available,
        sharpServerVersion: serverStatus.version,
      });

      if (serverStatus.available) {
        this.props.showSnack(
          `Sharp server detected (v${serverStatus.version}) - using native-speed processing`,
          { timeout: 4000, actions: ['dismiss'] },
        );
      }
    }, 100);

    // Show a helpful message if auto-save is enabled
    if (hasHandles) {
      this.props.showSnack(
        'Files will be automatically saved to their original location after processing',
        { timeout: 4000, actions: ['dismiss'] },
      );
    }

    // Show warning about skipped files from initial drop (after other messages)
    if (this.initialSkippedCount > 0) {
      globalThis.setTimeout(() => {
        this.showSkippedFilesWarning(this.initialSkippedCount);
      }, hasHandles ? 4500 : 500);
    }
  }

  /**
   * Show a subtle warning about skipped non-image files
   */
  private showSkippedFilesWarning(count: number) {
    const message = count === 1
      ? 'Skipped 1 file (not a supported image format)'
      : `Skipped ${count} files (not supported image formats)`;

    this.props.showSnack(message, {
      timeout: 4000,
      actions: ['dismiss'],
    });
  }

  /**
   * Add files to the queue with filtering for non-image files
   */
  private addFilesWithFiltering(files: FileWithHandle[]) {
    const { imageFiles, skippedCount } = filterImageFiles(files);

    if (imageFiles.length > 0) {
      this.batchQueue.addFiles(imageFiles);
      this.setState({
        items: this.batchQueue.getItems(),
        total: this.batchQueue.totalCount,
      });
    }

    // Show warning after a brief delay so it appears after the files are added
    if (skippedCount > 0) {
      globalThis.setTimeout(() => {
        this.showSkippedFilesWarning(skippedCount);
      }, 300);
    }
  }

  componentWillUnmount() {
    this.batchQueue.dispose();
  }

  private readonly onItemUpdate = (_item: BatchItem) => {
    this.setState({
      items: this.batchQueue.getItems(),
    });
    this.updateStats();
  };

  private readonly onProgress = (completed: number, total: number) => {
    this.setState({ completed, total });
    this.updateStats();
  };

  private updateStats() {
    const stats = this.batchQueue.getStats();
    this.setState({
      totalOriginalSize: stats.totalOriginalSize,
      totalCompressedSize: stats.totalCompressedSize,
      averageSavings: stats.averageSavings,
    });
  }

  private readonly onEncoderTypeChange = (type: EncoderType) => {
    this.setState({
      encoderState: {
        type,
        options: encoderMap[type].meta.defaultOptions,
      } as EncoderState,
    });
  };

  private readonly onEncoderOptionsChange = (options: EncoderOptions) => {
    this.setState((state) => ({
      encoderState: {
        ...state.encoderState,
        options,
      } as EncoderState,
    }));
  };

  private readonly onProcessorStateChange = (processorState: ProcessorState) => {
    this.setState({ processorState });
  };

  private readonly onReplaceOriginalsChange = (replaceOriginals: boolean) => {
    this.setState({ replaceOriginals });
  };

  private readonly onStart = async () => {
    this.setState({ isProcessing: true, isPaused: false });

    const willReplace = this.state.replaceOriginals && this.hasFileHandles();
    if (willReplace) {
      this.props.showSnack('Processing and saving files...', {
        timeout: 0,
        actions: [],
      });
    }

    await this.batchQueue.start(
      this.state.encoderState,
      this.state.processorState,
      this.state.replaceOriginals,
    );

    this.setState({ isProcessing: false });

    const stats = this.batchQueue.getStats();
    const savedMB = ((stats.totalOriginalSize - stats.totalCompressedSize) / (1024 * 1024)).toFixed(1);

    if (willReplace) {
      this.props.showSnack(
        `Done! ${stats.completedFiles} files saved, ${savedMB}MB reduced`,
        { timeout: 5000, actions: ['dismiss'] },
      );
    } else {
      this.props.showSnack(
        `Done! ${stats.completedFiles} files processed, ${savedMB}MB can be saved`,
        { timeout: 5000, actions: ['dismiss'] },
      );
    }
  };

  private readonly onPause = () => {
    this.batchQueue.pause();
    this.setState({ isPaused: true });
  };

  private readonly onResume = () => {
    this.batchQueue.resume();
    this.setState({ isPaused: false });
  };

  private readonly onCancel = () => {
    this.batchQueue.cancel();
    this.setState({ isProcessing: false, isPaused: false });
  };

  private readonly onRemoveFile = (id: string) => {
    this.batchQueue.removeFile(id);
    this.setState({
      items: this.batchQueue.getItems(),
      total: this.batchQueue.totalCount,
    });
  };

  private readonly onDownloadFile = (id: string) => {
    const item = this.batchQueue.getItem(id);
    if (!item?.result?.downloadUrl) return;

    const link = document.createElement('a');
    link.href = item.result.downloadUrl;
    link.download = item.file.name.replace(/\.[^.]*$/, `.${encoderMap[this.state.encoderState.type].meta.extension}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  private readonly onDownloadAll = async () => {
    const completedItems = this.state.items.filter(
      (item) => item.status === 'complete' && item.result,
    );

    if (completedItems.length === 0) {
      this.props.showSnack('No completed files to download', {
        timeout: 3000,
        actions: ['dismiss'],
      });
      return;
    }

    this.props.showSnack('Creating ZIP file...', {
      timeout: 0,
      actions: [],
    });

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const extension = encoderMap[this.state.encoderState.type].meta.extension;

      for (const item of completedItems) {
        if (item.result?.blob) {
          const newName = item.file.name.replace(/\.[^.]*$/, `.${extension}`);
          zip.file(newName, item.result.blob);
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `squoosh-batch-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      this.props.showSnack('ZIP download started!', {
        timeout: 3000,
        actions: ['dismiss'],
      });
    } catch (err) {
      console.error('Failed to create ZIP:', err);
      this.props.showSnack('Failed to create ZIP file', {
        timeout: 3000,
        actions: ['dismiss'],
      });
    }
  };

  private readonly onAddFilesClick = () => {
    this.fileInputRef?.click();
  };

  private readonly onAddFilesWithPicker = async () => {
    if (!supportsFileSystemAccess()) {
      this.onAddFilesClick();
      return;
    }

    try {
      const filesWithHandles = await openFilesWithHandles();
      if (filesWithHandles.length > 0) {
        this.addFilesWithFiltering(filesWithHandles);
      }
    } catch (err) {
      console.error('Failed to open files:', err);
      this.props.showSnack('Failed to open files', {
        timeout: 3000,
        actions: ['dismiss'],
      });
    }
  };

  private readonly onFileInputChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const filesWithHandles = filesFromFileList(input.files);
    if (filesWithHandles.length > 0) {
      this.addFilesWithFiltering(filesWithHandles);
    }
    input.value = '';
  };

  private readonly onFileDrop = (event: FileDropEvent) => {
    const files = event.files;
    if (!files || files.length === 0) return;

    const filesWithHandles = Array.from(files).map((file) => ({ file }));
    this.addFilesWithFiltering(filesWithHandles);
  };

  private hasFileHandles(): boolean {
    return this.state.items.some((item) => item.fileHandle !== undefined);
  }

  render(
    { onBack }: Props,
    {
      items,
      encoderState,
      processorState,
      replaceOriginals,
      isProcessing,
      isPaused,
      completed,
      total,
      totalOriginalSize,
      totalCompressedSize,
      averageSavings,
    }: State,
  ) {
    return (
      <div class={style.batchProcessor}>
        <input
          type="file"
          multiple
          accept="image/*"
          ref={(el) => { this.fileInputRef = el ?? undefined; }}
          onChange={this.onFileInputChange}
          class={style.hiddenInput}
        />

        <header class={style.header}>
          <button class={style.backButton} onClick={onBack}>
            <svg viewBox="0 0 61 53.3">
              <path
                class={style.backBlob}
                d="M0 25.6c-.5-7.1 4.1-14.5 10-19.1S23.4.1 32.2 0c8.8 0 19 1.6 24.4 8s5.6 17.8 1.7 27a29.7 29.7 0 01-20.5 18c-8.4 1.5-17.3-2.6-24.5-8S.5 32.6.1 25.6z"
              />
              <path
                class={style.backX}
                d="M41.6 17.1l-2-2.1-8.3 8.2-8.2-8.2-2 2 8.2 8.3-8.3 8.2 2.1 2 8.2-8.1 8.3 8.2 2-2-8.2-8.3z"
              />
            </svg>
          </button>
          <h1 class={style.headerTitle}>Batch Processing</h1>
          <button class={style.addFilesButton} onClick={this.onAddFilesWithPicker}>
            <svg viewBox="0 0 24 24" class={style.addIcon}>
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            Add Files
          </button>
        </header>

        <div class={style.content}>
          <aside class={style.sidebar}>
            <BatchSettings
              encoderState={encoderState}
              processorState={processorState}
              replaceOriginals={replaceOriginals}
              hasFileHandles={this.hasFileHandles()}
              isProcessing={isProcessing}
              fileCount={items.length}
              useSharpServer={this.state.useSharpServer}
              sharpServerVersion={this.state.sharpServerVersion}
              onEncoderTypeChange={this.onEncoderTypeChange}
              onEncoderOptionsChange={this.onEncoderOptionsChange}
              onProcessorStateChange={this.onProcessorStateChange}
              onReplaceOriginalsChange={this.onReplaceOriginalsChange}
              onStart={this.onStart}
              onDownloadAll={this.onDownloadAll}
            />
          </aside>

          <main class={style.main}>
            <BatchFileList
              items={items}
              onRemove={this.onRemoveFile}
              onDownload={this.onDownloadFile}
            />
          </main>
        </div>

        <footer class={style.footer}>
          <BatchProgress
            completed={completed}
            total={total}
            totalOriginalSize={totalOriginalSize}
            totalCompressedSize={totalCompressedSize}
            averageSavings={averageSavings}
            isProcessing={isProcessing}
            isPaused={isPaused}
            onPause={this.onPause}
            onResume={this.onResume}
            onCancel={this.onCancel}
          />
        </footer>
      </div>
    );
  }
}
