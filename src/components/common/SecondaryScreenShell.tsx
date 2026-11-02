import { forwardRef, type ReactNode } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconChevronLeft } from '@/components/ui/icons';
import styles from './SecondaryScreenShell.module.scss';

export type SecondaryScreenShellProps = {
  title: ReactNode;
  description?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  backAriaLabel?: string;
  rightAction?: ReactNode;
  isLoading?: boolean;
  loadingLabel?: ReactNode;
  className?: string;
  contentClassName?: string;
  topBarClassName?: string;
  children?: ReactNode;
};

export const SecondaryScreenShell = forwardRef<HTMLDivElement, SecondaryScreenShellProps>(
  function SecondaryScreenShell(
    {
      title,
      description,
      onBack,
      backLabel = 'Back',
      backAriaLabel,
      rightAction,
      isLoading = false,
      loadingLabel = 'Loading...',
      className = '',
      contentClassName = '',
      topBarClassName = '',
      children,
    },
    ref
  ) {
    const containerClassName = [styles.container, className].filter(Boolean).join(' ');
    const contentClasses = [styles.content, contentClassName].filter(Boolean).join(' ');

    return (
      <div className={containerClassName} ref={ref}>
        <div className={[styles.topBar, topBarClassName].filter(Boolean).join(' ')}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className={styles.backLink}
              aria-label={backAriaLabel}
            >
              <IconChevronLeft size={16} aria-hidden="true" />
              <span>{backLabel}</span>
            </button>
          )}
          <PageHeader title={title} description={description} actions={rightAction} />
        </div>

        {isLoading ? (
          <div className={styles.loadingState}>
            <LoadingSpinner size={16} />
            <span>{loadingLabel}</span>
          </div>
        ) : (
          <div className={contentClasses}>{children}</div>
        )}
      </div>
    );
  }
);
