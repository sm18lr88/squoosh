import { h, Component, createRef, Fragment } from 'preact';
import type { BatchItem, BatchItemStatus } from './BatchQueue';
import * as style from './style.css';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getStatusIcon(status: BatchItemStatus): string {
  switch (status) {
    case 'pending':
      return 'clock';
    case 'decoding':
    case 'processing':
    case 'encoding':
    case 'saving':
      return 'spinner';
    case 'complete':
      return 'check';
    case 'error':
      return 'error';
  }
}

function getStatusLabel(status: BatchItemStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'decoding':
      return 'Decoding';
    case 'processing':
      return 'Processing';
    case 'encoding':
      return 'Encoding';
    case 'saving':
      return 'Saving';
    case 'complete':
      return 'Complete';
    case 'error':
      return 'Error';
  }
}

function renderStatusIconSvg(statusIcon: string, styleObj: typeof style) {
  switch (statusIcon) {
    case 'spinner':
      return (
        <div class={styleObj.spinner}>
          <svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-dasharray="60"
              stroke-linecap="round"
            />
          </svg>
        </div>
      );
    case 'check':
      return (
        <svg viewBox="0 0 24 24" class={styleObj.statusIcon}>
          <path
            fill="currentColor"
            d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
          />
        </svg>
      );
    case 'error':
      return (
        <svg viewBox="0 0 24 24" class={styleObj.statusIconError}>
          <path
            fill="currentColor"
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" class={styleObj.statusIconPending}>
          <path
            fill="currentColor"
            d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
          />
        </svg>
      );
  }
}

interface Props {
  items: BatchItem[];
  onRemove: (id: string) => void;
  onDownload: (id: string) => void;
}

interface State {
  scrollTop: number;
  containerHeight: number;
}

const ROW_HEIGHT = 56 as const;
const BUFFER_ROWS = 5 as const;

export default class BatchFileList extends Component<Props, State> {
  state: State = {
    scrollTop: 0,
    containerHeight: 400,
  };

  private readonly containerRef = createRef<HTMLDivElement>();
  private resizeObserver?: ResizeObserver;

  componentDidMount() {
    if (this.containerRef.current) {
      this.setState({
        containerHeight: this.containerRef.current.clientHeight,
      });

      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this.setState({ containerHeight: entry.contentRect.height });
        }
      });
      this.resizeObserver.observe(this.containerRef.current);
    }
  }

  componentWillUnmount() {
    this.resizeObserver?.disconnect();
  }

  private readonly onScroll = (event: Event) => {
    const target = event.currentTarget as HTMLDivElement;
    this.setState({ scrollTop: target.scrollTop });
  };

  private readonly renderRow = (item: BatchItem, index: number) => {
    const statusIcon = getStatusIcon(item.status);
    const savings =
      item.result && item.result.originalSize > 0
        ? (
            ((item.result.originalSize - item.result.compressedSize) /
              item.result.originalSize) *
            100
          ).toFixed(1)
        : null;

    return (
      <div
        key={item.id}
        class={`${style.fileRow} ${style[`status-${item.status}`]}`}
        style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
      >
        <div class={style.fileInfo}>
          <div class={style.fileName}>{item.file.name}</div>
          <div class={style.fileMeta}>
            <span class={style.fileSize}>{formatBytes(item.file.size)}</span>
            {item.result && (
              <Fragment>
                <span class={style.arrow}>{' '}→{' '}</span>
                <span class={style.compressedSize}>
                  {formatBytes(item.result.compressedSize)}
                </span>
                {savings && (
                  <span
                    class={`${style.savings} ${Number(savings) > 0 ? style.savingsPositive : style.savingsNegative}`}
                  >
                    {Number(savings) > 0 ? '-' : '+'}
                    {Math.abs(Number(savings))}%
                  </span>
                )}
              </Fragment>
            )}
          </div>
        </div>

        <div class={style.fileStatus}>
          {renderStatusIconSvg(statusIcon, style)}
          <span class={style.statusLabel}>{getStatusLabel(item.status)}</span>
        </div>

        <div class={style.fileActions}>
          {item.status === 'complete' && item.result?.downloadUrl && (
            <button
              class={style.iconButton}
              onClick={() => this.props.onDownload(item.id)}
              title="Download"
            >
              <svg viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
                />
              </svg>
            </button>
          )}
          {item.status !== 'complete' && (
            <button
              class={style.iconButton}
              onClick={() => this.props.onRemove(item.id)}
              title="Remove"
            >
              <svg viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  render({ items }: Props, { scrollTop, containerHeight }: State) {
    const totalHeight = items.length * ROW_HEIGHT;
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS,
    );
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_ROWS,
    );

    const visibleItems = items.slice(startIndex, endIndex);

    return (
      <div class={style.fileListContainer}>
        <div class={style.fileListHeader}>
          <span class={style.headerCell}>File</span>
          <span class={style.headerCell}>Status</span>
          <span class={style.headerCell}>Actions</span>
        </div>
        <div
          ref={this.containerRef}
          class={style.fileListScroller}
          onScroll={this.onScroll}
        >
          <div class={style.fileListContent} style={{ height: totalHeight }}>
            {visibleItems.map((item, i) =>
              this.renderRow(item, startIndex + i),
            )}
          </div>
        </div>
        {items.length === 0 && (
          <div class={style.emptyState}>
            <svg viewBox="0 0 24 24" class={style.emptyIcon}>
              <path
                fill="currentColor"
                d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z"
              />
            </svg>
            <p>No files added yet</p>
            <p class={style.emptyHint}>
              Drop images here or use the button to add files
            </p>
          </div>
        )}
      </div>
    );
  }
}
