import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import styles from './OAuthHeader.module.scss';

export interface OAuthHeaderProps {
  providerCount: number;
  waitingCount: number;
  addedCount: number;
}

/**
 * 标题领衔 + ▍mono 遥测 meta 行（与凭证库/额度页同语汇，无 eyebrow、无页头按钮）。
 * meta 语义：等待授权数是「进行中」（墨色 + 呼吸点），本次新增是「活数据」（绿）。
 */
export function OAuthHeader({ providerCount, waitingCount, addedCount }: OAuthHeaderProps) {
  const { t } = useTranslation();

  return (
    <PageHeader
      title={t('nav.oauth', { defaultValue: 'OAuth' })}
      description={t('auth_login.page_description')}
      meta={
        <>
          <span>{t('auth_login.meta_providers', { count: providerCount })}</span>
          {waitingCount > 0 && (
            <span className={styles.metaWaiting}>
              <span className={styles.pulse} aria-hidden="true" />
              {t('auth_login.meta_waiting', { count: waitingCount })}
            </span>
          )}
          {addedCount > 0 && (
            <span className={styles.metaAdded}>
              <span className={styles.addedDot} aria-hidden="true" />
              {t('auth_login.meta_added', { count: addedCount })}
            </span>
          )}
        </>
      }
    />
  );
}
