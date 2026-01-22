import type { FileDropEvent, FileDropElement } from 'file-drop-element';
import type SnackBarElement from 'shared/custom-els/snack-bar';
import type { SnackOptions } from 'shared/custom-els/snack-bar';
import type { FileWithHandle } from 'client/lazy-app/util/fs-access';

import { h, Component, type JSX } from 'preact';

import { linkRef } from 'shared/prerendered-app/util';
import * as style from './style.css';
import 'add-css:./style.css';
import 'file-drop-element';
import 'shared/custom-els/snack-bar';
import Intro from 'shared/prerendered-app/Intro';
import 'shared/custom-els/loading-spinner';

const ROUTE_EDITOR = '/editor';
const ROUTE_BATCH = '/batch';

const compressPromise = import('client/lazy-app/Compress');
const batchProcessorPromise = import('client/lazy-app/BatchProcessor');
const swBridgePromise = import('client/lazy-app/sw-bridge');
const fsAccessPromise = import('client/lazy-app/util/fs-access');

function back() {
  globalThis.history.back();
}

interface Props {}

interface State {
  awaitingShareTarget: boolean;
  file?: File;
  files?: FileWithHandle[];
  isEditorOpen: boolean;
  isBatchOpen: boolean;
  Compress?: typeof import('client/lazy-app/Compress').default;
  BatchProcessor?: typeof import('client/lazy-app/BatchProcessor').default;
}

export default class App extends Component<Props, State> {
  state: State = {
    awaitingShareTarget: new URL(globalThis.location.href).searchParams.has(
      'share-target',
    ),
    isEditorOpen: false,
    isBatchOpen: false,
    file: undefined,
    files: undefined,
    Compress: undefined,
    BatchProcessor: undefined,
  };

  snackbar?: SnackBarElement;
  fileDropEl?: FileDropElement;

  constructor() {
    super();

    // Since iOS 10, Apple tries to prevent disabling pinch-zoom. This is great in theory, but
    // really breaks things on Squoosh, as you can easily end up zooming the UI when you mean to
    // zoom the image. Once you've done this, it's really difficult to undo. Anyway, this seems to
    // prevent it.
    document.body.addEventListener('gesturestart', (event: any) => {
      event.preventDefault();
    });

    globalThis.addEventListener('popstate', this.onPopState);
  }

  private readonly initializeModules = () => {
    compressPromise
      .then((module) => {
        this.setState({ Compress: module.default });
      })
      .catch(() => {
        this.showSnack('Failed to load app');
      });

    batchProcessorPromise
      .then((module) => {
        this.setState({ BatchProcessor: module.default });
      })
      .catch(() => {
        this.showSnack('Failed to load batch processor');
      });

    swBridgePromise.then(async ({ offliner, getSharedImage }) => {
      offliner(this.showSnack);
      if (!this.state.awaitingShareTarget) return;
      const file = await getSharedImage();
      // Remove the ?share-target from the URL
      globalThis.history.replaceState('', '', '/');
      this.openEditor();
      this.setState({ file, awaitingShareTarget: false });
    });
  };

  componentDidMount() {
    // Initialize modules asynchronously
    this.initializeModules();

    // Listen for native drop to get file handles (File System Access API)
    this.fileDropEl?.addEventListener('drop', this.onNativeDrop as EventListener);
    // Also listen for the custom filedrop event as fallback
    this.fileDropEl?.addEventListener('filedrop', this.onFileDrop as EventListener);
  }

  componentWillUnmount() {
    this.fileDropEl?.removeEventListener('drop', this.onNativeDrop as EventListener);
    this.fileDropEl?.removeEventListener('filedrop', this.onFileDrop as EventListener);
  }

  private readonly onNativeDrop = async (event: DragEvent) => {
    // Try to get file handles from the drop event for automatic saving
    if (!event.dataTransfer) return;

    const fsAccess = await fsAccessPromise;
    if (fsAccess.supportsFileSystemHandleFromDrop()) {
      // Prevent the default filedrop event from firing since we're handling it
      event.stopPropagation();
      event.preventDefault();

      const filesWithHandles = await fsAccess.filesFromDataTransfer(event.dataTransfer);
      if (filesWithHandles.length === 0) return;

      if (filesWithHandles.length === 1) {
        this.openEditor();
        this.setState({ file: filesWithHandles[0].file, files: undefined });
      } else {
        this.openBatch();
        this.setState({ files: filesWithHandles, file: undefined });
      }
    }
    // If not supported, let the filedrop event handle it
  };

  private readonly onFileDrop = ({ files }: FileDropEvent) => {
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      // Single file: use existing editor
      this.openEditor();
      this.setState({ file: files[0], files: undefined });
    } else {
      // Multiple files: use batch processor
      const filesWithHandles: FileWithHandle[] = Array.from(files).map(
        (file) => ({ file }),
      );
      this.openBatch();
      this.setState({ files: filesWithHandles, file: undefined });
    }
  };

  private readonly onIntroPickFile = (file: File) => {
    this.openEditor();
    this.setState({ file, files: undefined });
  };

  private readonly onIntroPickFiles = (files: File[]) => {
    const filesWithHandles: FileWithHandle[] = files.map((file) => ({ file }));
    this.openBatch();
    this.setState({ files: filesWithHandles, file: undefined });
  };

  private readonly showSnack = (
    message: string,
    options: SnackOptions = {},
  ): Promise<string> => {
    if (!this.snackbar) throw new Error('Snackbar missing');
    return this.snackbar.showSnackbar(message, options);
  };

  private readonly onPopState = () => {
    this.setState({
      isEditorOpen: globalThis.location.pathname === ROUTE_EDITOR,
      isBatchOpen: globalThis.location.pathname === ROUTE_BATCH,
    });
  };

  private readonly openEditor = () => {
    if (this.state.isEditorOpen) return;
    // Change path, but preserve query string.
    const editorURL = new URL(globalThis.location.href);
    editorURL.pathname = ROUTE_EDITOR;
    globalThis.history.pushState(null, '', editorURL.href);
    this.setState({ isEditorOpen: true, isBatchOpen: false });
  };

  private readonly openBatch = () => {
    if (this.state.isBatchOpen) return;
    // Change path, but preserve query string.
    const batchURL = new URL(globalThis.location.href);
    batchURL.pathname = ROUTE_BATCH;
    globalThis.history.pushState(null, '', batchURL.href);
    this.setState({ isBatchOpen: true, isEditorOpen: false });
  };

  render(
    _props: Props,
    {
      file,
      files,
      isEditorOpen,
      isBatchOpen,
      Compress,
      BatchProcessor,
      awaitingShareTarget,
    }: State,
  ) {
    const showSpinner =
      awaitingShareTarget ||
      (isEditorOpen && !Compress) ||
      (isBatchOpen && !BatchProcessor);

    let content: JSX.Element | false;
    if (showSpinner) {
      content = <loading-spinner class={style.appLoader} />;
    } else if (isBatchOpen) {
      content = BatchProcessor && (
        <BatchProcessor
          files={files || []}
          showSnack={this.showSnack}
          onBack={back}
        />
      );
    } else if (isEditorOpen) {
      content = Compress && file && (
        <Compress file={file} showSnack={this.showSnack} onBack={back} />
      );
    } else {
      content = (
        <Intro
          onFile={this.onIntroPickFile}
          onFiles={this.onIntroPickFiles}
          showSnack={this.showSnack}
        />
      );
    }

    return (
      <div class={style.app}>
        <file-drop accept="image/*" ref={linkRef(this, 'fileDropEl')} class={style.drop}>
          {content}
          <snack-bar ref={linkRef(this, 'snackbar')} />
        </file-drop>
      </div>
    );
  }
}
