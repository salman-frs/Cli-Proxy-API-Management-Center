import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconRefreshCw } from '@/components/ui/icons';
import styles from './QuotaHeader.module.scss';

export type QuotaHeaderProps = {
  totalCount: number;
  loadedCount: number;
  attentionCount: number;
  refreshing: boolean;
  disableControls: boolean;
  onRefreshAll: () => void;
};

/**
 * 额度页头部：标题领衔 + ▍mono 遥测 meta 行 + 墨色药丸「刷新全部」。
 * 与凭证库头部同语汇（无 eyebrow —— ▍游标挂在 meta 行开头）。
 *
 * 入场：三处 `data-reveal` 交给页面壳的 useRevealGroup 统一编排
 * （标题 0ms → meta 70ms → 动作 140ms → tabs 210ms）。
 */
export function QuotaHeader(props: QuotaHeaderProps) {
  const { totalCount, loadedCount, attentionCount, refreshing, disableControls, onRefreshAll } =
    props;
  const { t } = useTranslation();

  return (
    <PageHeader
      title={t('nav.quota_management')}
      description={t('quota_management.page_description')}
      meta={
        <>
          <span>{t('quota_management.meta_credentials', { count: totalCount })}</span>
          <span className={loadedCount > 0 ? styles.metaLoaded : styles.metaItem}>
            {t('quota_management.meta_loaded', { count: loadedCount })}
          </span>
          {attentionCount > 0 && (
            <span className={styles.metaAttention}>
              {t('quota_management.meta_attention', { count: attentionCount })}
            </span>
          )}
        </>
      }
      actions={
        <Button variant="secondary" onClick={onRefreshAll} disabled={disableControls || refreshing}>
          <IconRefreshCw size={14} className={refreshing ? styles.spinning : undefined} />
          {t('quota_management.refresh_all_credentials')}
        </Button>
      }
    />
  );
}
