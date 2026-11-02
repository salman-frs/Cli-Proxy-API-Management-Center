import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconEye, IconPencil, IconTrash2 } from '@/components/ui/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { ProviderStatusBar } from '@/components/providers/ProviderStatusBar';
import {
  getOpenAIProviderRecentStatusData,
  getOpenAIProviderTotalStats,
  getProviderRecentStatusData,
  getProviderTotalStats,
  getProviderUsageKey,
  type ProviderRecentUsageMap,
} from '@/components/providers/utils';
import type { OpenAIProviderConfig } from '@/types';
import type { StatusBarData } from '@/utils/recentRequests';
import type { ProviderResource } from '../types';
import { isMultiProtocolSponsorBrand } from '../sponsorDefinitions';
import styles from './ProviderResourceTable.module.scss';
import statusBarStyles from './providerStatusBar.module.scss';

interface ProviderResourceTableProps {
  resources: ProviderResource[];
  selectedId?: string | null;
  disableMutations?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  onView: (resource: ProviderResource) => void;
  onEdit: (resource: ProviderResource) => void;
  onDelete: (resource: ProviderResource) => void;
  onToggleDisabled?: (resource: ProviderResource, disabled: boolean) => void;
}

const columnWidths = ['164px', 'auto', '80px', '140px', '160px', '148px'];

const isSponsorResource = (resource: ProviderResource): boolean =>
  isMultiProtocolSponsorBrand(resource.brand);

const resolveStatusBarData = (
  resource: ProviderResource,
  usageByProvider: ProviderRecentUsageMap
): StatusBarData => {
  if (resource.brand === 'openaiCompatibility') {
    return getOpenAIProviderRecentStatusData(resource.raw as OpenAIProviderConfig, usageByProvider);
  }
  return getProviderRecentStatusData(
    usageByProvider,
    getProviderUsageKey(resource.brand),
    resource.apiKey ?? undefined,
    resource.baseUrl ?? undefined
  );
};

const resolveTotalStats = (
  resource: ProviderResource,
  usageByProvider: ProviderRecentUsageMap
): { success: number; failure: number } => {
  if (resource.brand === 'openaiCompatibility') {
    return getOpenAIProviderTotalStats(resource.raw as OpenAIProviderConfig, usageByProvider);
  }
  return getProviderTotalStats(
    usageByProvider,
    getProviderUsageKey(resource.brand),
    resource.apiKey ?? undefined,
    resource.baseUrl ?? undefined
  );
};

export function ProviderResourceTable({
  resources,
  selectedId,
  disableMutations,
  usageByProvider,
  onView,
  onEdit,
  onDelete,
  onToggleDisabled,
}: ProviderResourceTableProps) {
  const { t } = useTranslation();

  const renderMetric = (key: string, label: string, value: number) => (
    <span key={key} className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </span>
  );

  const renderFlagTag = (key: string, label: string) => (
    <span key={key} className={styles.flagTag}>
      {label}
    </span>
  );

  const renderProtocolSummary = (r: ProviderResource) =>
    (r.flags.protocols ?? [])
      .map((protocol) => t(`providersPage.sponsor.protocols.${protocol}`))
      .join(' / ');

  const renderModelsSummary = (r: ProviderResource) => {
    if (isSponsorResource(r)) {
      return (
        <div className={styles.flags}>
          {(r.flags.protocols ?? []).map((protocol) =>
            renderFlagTag(protocol, t(`providersPage.sponsor.protocols.${protocol}`))
          )}
        </div>
      );
    }
    const metrics = [renderMetric('models', t('providersPage.table.metrics.models'), r.modelCount)];
    if (r.brand === 'openaiCompatibility') {
      metrics.push(renderMetric('keys', t('providersPage.table.metrics.keys'), r.apiKeyEntryCount));
    }
    metrics.push(renderMetric('headers', t('providersPage.table.metrics.headers'), r.headerCount));

    const flags: ReactNode[] = [];
    if ((r.brand === 'codex' || r.brand === 'xai') && r.flags.websockets) {
      flags.push(renderFlagTag('ws', t('providersPage.table.websocketsTag')));
    }
    if (r.brand === 'claude' && r.flags.cloakEnabled) {
      flags.push(renderFlagTag('cloak', t('providersPage.table.cloakTag')));
    }
    if (r.brand === 'claude' && r.flags.claudeCodeCliProfile) {
      flags.push(renderFlagTag('cli-profile', t('providersPage.table.cliProfileTag')));
    }

    return (
      <div className={styles.configCell}>
        <div className={styles.metrics}>{metrics}</div>
        {flags.length > 0 ? <div className={styles.flags}>{flags}</div> : null}
      </div>
    );
  };

  const renderStatus = (r: ProviderResource) => {
    const showUsage = usageByProvider && !isSponsorResource(r);
    const stats = showUsage ? resolveTotalStats(r, usageByProvider) : null;
    return (
      <div className={styles.statusCell}>
        <span
          className={`${styles.statusLabel} ${r.disabled ? styles.statusOff : styles.statusOn}`}
        >
          <span className={styles.statusDot} aria-hidden="true" />
          {r.disabled ? t('providersPage.status.disabled') : t('providersPage.status.active')}
          {stats ? (
            <span className={styles.statCounts}>
              <span title={t('stats.success')}>
                <span className={styles.visuallyHidden}>{t('stats.success')} </span>
                <span className={styles.statSuccess}>{stats.success}</span>
              </span>
              <span aria-hidden="true">/</span>
              <span title={t('stats.failure')}>
                <span className={styles.visuallyHidden}>{t('stats.failure')} </span>
                <span className={stats.failure > 0 ? styles.statFailure : undefined}>
                  {stats.failure}
                </span>
              </span>
            </span>
          ) : null}
        </span>
        {showUsage ? (
          <div className={styles.statusBarWrap}>
            <ProviderStatusBar
              statusData={resolveStatusBarData(r, usageByProvider)}
              styles={statusBarStyles}
            />
          </div>
        ) : null}
      </div>
    );
  };

  const renderPrimary = (r: ProviderResource) => {
    if (isSponsorResource(r)) {
      return (
        <div className={styles.primaryCell}>
          <span className={styles.primaryName}>{r.name ?? r.identifier}</span>
          <span className={styles.primarySub}>
            {r.apiKeyPreview ?? t('providersPage.status.notConfigured')}
          </span>
        </div>
      );
    }
    if (r.brand === 'openaiCompatibility') {
      const extra = r.apiKeyEntryCount > 1 ? ` · +${r.apiKeyEntryCount - 1}` : '';
      return (
        <div className={styles.primaryCell}>
          <span className={styles.primaryName}>{r.name ?? r.identifier}</span>
          <span className={styles.primarySub}>{(r.apiKeyPreview ?? '—') + extra}</span>
        </div>
      );
    }
    return (
      <div className={styles.primaryCell}>
        <span className={`${styles.primaryName} ${styles.mono}`}>{r.apiKeyPreview ?? '—'}</span>
        {r.authIndex ? <span className={styles.primarySub}>auth: {r.authIndex}</span> : null}
      </div>
    );
  };

  const renderBaseUrl = (r: ProviderResource) => {
    if (isSponsorResource(r)) {
      return <span className={styles.baseUrl}>{renderProtocolSummary(r)}</span>;
    }
    if (r.brand === 'claude' && !r.baseUrl) {
      return (
        <span className={styles.baseUrl} title="https://api.anthropic.com">
          https://api.anthropic.com{' '}
          <span className={styles.muted}>{t('providersPage.status.defaultSuffix')}</span>
        </span>
      );
    }
    if (!r.baseUrl) {
      return <span className={styles.muted}>{t('providersPage.status.notSet')}</span>;
    }
    return (
      <span className={styles.baseUrl} title={r.baseUrl}>
        {r.baseUrl}
      </span>
    );
  };

  return (
    <Table
      className={styles.providerTable}
      cols={columnWidths.map((w, i) => (
        <col key={i} style={w === 'auto' ? undefined : { width: w }} />
      ))}
    >
      <TableHeader>
        <TableRow>
          <TableHead>{t('providersPage.table.key')}</TableHead>
          <TableHead>{t('providersPage.table.baseUrl')}</TableHead>
          <TableHead>{t('providersPage.table.prefix')}</TableHead>
          <TableHead>{t('providersPage.table.models')}</TableHead>
          <TableHead>{t('providersPage.table.status')}</TableHead>
          <TableHead alignRight className={styles.actionsHead}>
            <span className={styles.visuallyHidden}>{t('providersPage.table.actions')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => (
          <TableRow
            key={resource.id}
            selected={resource.id === selectedId}
            className={resource.disabled ? styles.rowDisabled : undefined}
          >
            <TableCell className={styles.keyCell}>{renderPrimary(resource)}</TableCell>
            <TableCell data-label={t('providersPage.table.baseUrl')}>
              {renderBaseUrl(resource)}
            </TableCell>
            <TableCell data-label={t('providersPage.table.prefix')}>
              {resource.prefix ? (
                <span className={styles.prefix}>{resource.prefix}</span>
              ) : (
                <span className={styles.muted}>—</span>
              )}
            </TableCell>
            <TableCell data-label={t('providersPage.table.models')}>
              {renderModelsSummary(resource)}
            </TableCell>
            <TableCell className={styles.statusTd} data-label={t('providersPage.table.status')}>
              {renderStatus(resource)}
            </TableCell>
            <TableCell alignRight className={styles.actionsCell}>
              <div className={styles.actions}>
                {onToggleDisabled ? (
                  <span className={styles.toggleWrap} onClick={(e) => e.stopPropagation()}>
                    <ToggleSwitch
                      checked={!resource.disabled}
                      disabled={disableMutations}
                      onChange={(value) => onToggleDisabled(resource, !value)}
                      ariaLabel={
                        resource.disabled
                          ? t('providersPage.actions.enable')
                          : t('providersPage.actions.disable')
                      }
                    />
                  </span>
                ) : null}
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={t('providersPage.actions.view')}
                  title={t('providersPage.actions.view')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(resource);
                  }}
                >
                  <IconEye size={15} />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={t('providersPage.actions.edit')}
                  title={t('providersPage.actions.edit')}
                  disabled={disableMutations}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(resource);
                  }}
                >
                  <IconPencil size={15} />
                </button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                  aria-label={t('providersPage.actions.delete')}
                  title={t('providersPage.actions.delete')}
                  disabled={disableMutations}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(resource);
                  }}
                >
                  <IconTrash2 size={15} />
                </button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
