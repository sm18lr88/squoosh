import { h, FunctionalComponent, Fragment } from 'preact';
import * as style from './style.css';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface Props {
  completed: number;
  total: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  averageSavings: number;
  isProcessing: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

const BatchProgress: FunctionalComponent<Props> = ({
  completed,
  total,
  totalOriginalSize,
  totalCompressedSize,
  averageSavings,
  isProcessing,
  isPaused,
  onPause,
  onResume,
  onCancel,
}) => {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const savedBytes = totalOriginalSize - totalCompressedSize;

  return (
    <div class={style.progressContainer}>
      <div class={style.progressBar}>
        <div
          class={style.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div class={style.progressStats}>
        <div class={style.progressStat}>
          <span class={style.statLabel}>Files</span>
          <span class={style.statValue}>
            {completed}{' '}/{' '}{total}
          </span>
        </div>

        {completed > 0 && (
          <Fragment>
            <div class={style.progressStat}>
              <span class={style.statLabel}>Saved</span>
              <span class={style.statValue}>{formatBytes(savedBytes)}</span>
            </div>

            <div class={style.progressStat}>
              <span class={style.statLabel}>Avg. Reduction</span>
              <span class={style.statValue}>{averageSavings.toFixed(1)}%</span>
            </div>

            <div class={style.progressStat}>
              <span class={style.statLabel}>Original</span>
              <span class={style.statValue}>
                {formatBytes(totalOriginalSize)}
              </span>
            </div>

            <div class={style.progressStat}>
              <span class={style.statLabel}>Compressed</span>
              <span class={style.statValue}>
                {formatBytes(totalCompressedSize)}
              </span>
            </div>
          </Fragment>
        )}
      </div>

      {isProcessing && (
        <div class={style.progressActions}>
          {isPaused ? (
            <button class={style.actionButton} onClick={onResume}>
              <svg viewBox="0 0 24 24" class={style.actionIcon}>
                <path d="M8 5v14l11-7z" />
              </svg>
              Resume
            </button>
          ) : (
            <button class={style.actionButton} onClick={onPause}>
              <svg viewBox="0 0 24 24" class={style.actionIcon}>
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              Pause
            </button>
          )}

          <button
            class={`${style.actionButton} ${style.cancelButton}`}
            onClick={onCancel}
          >
            <svg viewBox="0 0 24 24" class={style.actionIcon}>
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default BatchProgress;
