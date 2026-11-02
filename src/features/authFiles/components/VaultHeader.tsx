import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconKey, IconUpload } from '@/components/ui/icons';
import styles from './VaultHeader.module.scss';

export type VaultHeaderProps = {
  totalCount: number;
  activeCount: number;
  problemCount: number;
  loading: boolean;
  uploading: boolean;
  disableControls: boolean;
  onUpload: () => void;
  refreshingCredentials?: boolean;
  credentialRefreshDisabled?: boolean;
  onRefreshCredentials?: () => void;
};

/**
 * 凭证库头部：eyebrow（▍游标前缀）+ 标题 + mono 遥测 meta 行 + 动作区。
 * meta 行同时承载 VaultPulse 的文字等价信息（谱条本身 aria-hidden）。
 */
export function VaultHeader(props: VaultHeaderProps) {
  const {
    totalCount,
    activeCount,
    problemCount,
    loading,
    uploading,
    disableControls,
    onUpload,
    refreshingCredentials = false,
    credentialRefreshDisabled = false,
    onRefreshCredentials,
  } = props;
  const { t } = useTranslation();

  return (
    <PageHeader
      title={t('nav.auth_files')}
      description={t('auth_files.page_description')}
      meta={
        <>
          <span>{t('auth_files.meta_total', { count: totalCount })}</span>
          <span className={activeCount > 0 ? styles.metaActive : styles.metaItem}>
            <span className={styles.dot} aria-hidden="true" />
            {t('auth_files.meta_active', { count: activeCount })}
          </span>
          {problemCount > 0 && (
            <span className={styles.metaProblem}>
              <span className={styles.dot} aria-hidden="true" />
              {t('auth_files.meta_problem', { count: problemCount })}
            </span>
          )}
        </>
      }
      actions={
        <>
          {onRefreshCredentials && (
            <Button
              variant="secondary"
              className={styles.refreshAllButton}
              onClick={onRefreshCredentials}
              aria-label={t('auth_files.refresh_all_button')}
              disabled={
                disableControls || loading || refreshingCredentials || credentialRefreshDisabled
              }
            >
              {refreshingCredentials ? <LoadingSpinner size={14} /> : <IconKey size={14} />}
              <span className={styles.collapsibleLabel}>{t('auth_files.refresh_all_button')}</span>
            </Button>
          )}
          <Button onClick={onUpload} disabled={disableControls || uploading}>
            {uploading ? <LoadingSpinner size={14} /> : <IconUpload size={14} />}
            {t('auth_files.upload_button')}
          </Button>
        </>
      }
    />
  );
}
