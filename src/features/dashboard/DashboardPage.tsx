import { useId, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconChevronRight,
  IconSidebarAuthFiles,
  IconSidebarConfig,
  IconSidebarLogs,
  IconSidebarProviders,
  IconSidebarQuota,
  IconSidebarSystem,
} from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/stores';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { formatCompactNumber, formatDateValue, formatPercent } from '@/utils/format';
import { useDashboardOverview } from './hooks/useDashboardOverview';
import { Meter } from './components/Meter';
import { Sparkline } from './components/Sparkline';
import { ThroughputChart } from './components/ThroughputChart';
import { TRAFFIC_BUCKET_COUNT } from './types';
import {
  bucketsToMinutes,
  overviewStatus,
  providerLabel,
  splitWindowMinutes,
  type OverviewStatus,
} from './utils';
import styles from './dashboard.module.scss';

const DASH = '—';

const STATUS_TONE_CLASS: Record<OverviewStatus, string> = {
  operational: styles.toneSuccess,
  degraded: styles.toneWarning,
  failing: styles.toneDanger,
  offline: styles.toneDanger,
  idle: styles.toneNeutral,
  connecting: styles.toneNeutral,
};

const formatCount = (value: number): string =>
  value < 100_000 ? value.toLocaleString() : formatCompactNumber(value);

interface Kpi {
  key: string;
  label: string;
  value: ReactNode;
  caption: string;
  loading: boolean;
}

interface CardProps {
  title: string;
  description?: string;
  link?: { to: string; label: string };
  className?: string;
  children: ReactNode;
}

function DashboardCard({ title, description, link, className, children }: CardProps) {
  const titleId = useId();
  return (
    <section
      className={[styles.card, className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
    >
      <header className={styles.cardHeader}>
        <div className={styles.cardHeading}>
          <h2 id={titleId} className={styles.cardTitle}>
            {title}
          </h2>
          {description && <p className={styles.cardDescription}>{description}</p>}
        </div>
        {link && (
          <Link to={link.to} className={styles.cardLink}>
            {link.label}
            <IconChevronRight size={14} aria-hidden="true" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className={styles.skeletonRows}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={16} rounded={4} />
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const serverVersion = useAuthStore((state) => state.serverVersion);
  const serverBuildDate = useAuthStore((state) => state.serverBuildDate);

  const {
    connectionStatus,
    connected,
    loading,
    trafficLoading,
    modelsLoading,
    config,
    counts,
    traffic,
    providers,
    credentials,
    refresh,
  } = useDashboardOverview();

  useHeaderRefresh(refresh, connected);

  const windowLabel = useMemo(() => {
    const windowMinutes =
      traffic.windowMinutes > 0 ? traffic.windowMinutes : bucketsToMinutes(TRAFFIC_BUCKET_COUNT);
    const { hours, minutes } = splitWindowMinutes(windowMinutes);
    if (hours === 0) return t('dashboard.window_m', { minutes });
    if (minutes === 0) return t('dashboard.window_h', { hours });
    return t('dashboard.window_hm', { hours, minutes });
  }, [traffic.windowMinutes, t]);

  const routingStrategy = useMemo(() => {
    const raw = config?.routingStrategy?.trim() || 'round-robin';
    if (raw === 'round-robin') return t('basic_settings.routing_strategy_round_robin');
    if (raw === 'weighted-round-robin') {
      return t('basic_settings.routing_strategy_weighted_round_robin');
    }
    if (raw === 'fill-first') return t('basic_settings.routing_strategy_fill_first');
    return raw;
  }, [config?.routingStrategy, t]);

  const unknownProviderLabel = t('dashboard.provider_unknown');
  const status = overviewStatus(
    connectionStatus,
    traffic.successRate,
    credentials?.unavailable ?? 0
  );

  const rawVersion = serverVersion?.trim().replace(/^[vV]+/, '') ?? '';
  const versionLabel = /^\d/.test(rawVersion) ? `v${rawVersion}` : rawVersion;

  const credentialsCaption = (): string => {
    if (!credentials || credentials.total === 0) return t('dashboard.stat_credentials_empty');
    if (credentials.unavailable + credentials.disabled === 0) {
      return t('dashboard.kpi_credentials_all_active');
    }
    return t('dashboard.kpi_credentials_caption', {
      unavailable: credentials.unavailable,
      disabled: credentials.disabled,
    });
  };

  const kpis: Kpi[] = [
    {
      key: 'requests',
      label: t('dashboard.kpi_requests'),
      value: connected ? formatCount(traffic.total) : DASH,
      caption: t('dashboard.kpi_requests_caption', { window: windowLabel }),
      loading: trafficLoading,
    },
    {
      key: 'success',
      label: t('dashboard.success_rate'),
      value: traffic.successRate === null ? DASH : formatPercent(traffic.successRate),
      caption:
        traffic.total > 0
          ? t('dashboard.kpi_success_caption', {
              success: traffic.totalSuccess.toLocaleString(),
              failed: traffic.totalFailure.toLocaleString(),
            })
          : t('status_bar.no_requests'),
      loading: trafficLoading,
    },
    {
      key: 'credentials',
      label: t('dashboard.stat_credentials'),
      value: !credentials ? (
        DASH
      ) : credentials.total === 0 ? (
        '0'
      ) : (
        <>
          {credentials.active.toLocaleString()}
          <span className={styles.kpiTotal}>/{credentials.total.toLocaleString()}</span>
        </>
      ),
      caption: credentialsCaption(),
      loading,
    },
    {
      key: 'providerKeys',
      label: t('dashboard.stat_provider_keys'),
      value: counts.providerKeys === null ? DASH : counts.providerKeys.toLocaleString(),
      caption: t('dashboard.kpi_provider_keys_caption'),
      loading,
    },
    {
      key: 'models',
      label: t('dashboard.stat_models'),
      value: counts.models === null ? DASH : counts.models.toLocaleString(),
      caption: t('dashboard.kpi_models_caption'),
      loading: loading || modelsLoading,
    },
  ];

  const runtimeRows: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: t('dashboard.runtime_routing'), value: routingStrategy },
    { label: t('dashboard.runtime_retry'), value: String(config?.requestRetry ?? 0) },
    {
      label: t('dashboard.runtime_management_keys'),
      value: counts.managementKeys === null ? DASH : String(counts.managementKeys),
    },
    { label: t('dashboard.runtime_version'), value: serverVersion?.trim() || DASH, mono: true },
    {
      label: t('dashboard.runtime_build'),
      value: formatDateValue(serverBuildDate, i18n.language) || DASH,
    },
    {
      label: t('dashboard.runtime_proxy'),
      value: config?.proxyUrl?.trim() || DASH,
      mono: Boolean(config?.proxyUrl?.trim()),
    },
  ];

  const runtimeToggles = config
    ? [
        { label: t('dashboard.runtime_debug'), on: Boolean(config.debug) },
        { label: t('dashboard.runtime_file_logging'), on: Boolean(config.loggingToFile) },
        { label: t('dashboard.runtime_request_log'), on: Boolean(config.requestLog) },
        { label: t('dashboard.runtime_ws_auth'), on: Boolean(config.wsAuth) },
        { label: t('dashboard.runtime_model_prefix'), on: Boolean(config.forceModelPrefix) },
      ]
    : [];

  const credentialSegments = credentials
    ? [
        {
          key: 'active',
          label: t('dashboard.health_active'),
          count: credentials.active,
          className: styles.segmentActive,
        },
        {
          key: 'unavailable',
          label: t('dashboard.health_unavailable'),
          count: credentials.unavailable,
          className: styles.segmentUnavailable,
        },
        {
          key: 'disabled',
          label: t('dashboard.health_disabled'),
          count: credentials.disabled,
          className: styles.segmentDisabled,
        },
      ]
    : [];

  const shortcuts = [
    {
      to: '/ai-providers',
      icon: <IconSidebarProviders size={16} />,
      title: t('nav.ai_providers'),
      description: t('dashboard.cta_providers_desc'),
    },
    {
      to: '/auth-files',
      icon: <IconSidebarAuthFiles size={16} />,
      title: t('nav.auth_files'),
      description: t('dashboard.cta_auth_files_desc'),
    },
    {
      to: '/config',
      icon: <IconSidebarConfig size={16} />,
      title: t('nav.config_management'),
      description: t('dashboard.cta_config_desc'),
    },
    {
      to: '/quota',
      icon: <IconSidebarQuota size={16} />,
      title: t('nav.quota_management'),
      description: t('dashboard.cta_quota_desc'),
    },
    {
      to: '/logs',
      icon: <IconSidebarLogs size={16} />,
      title: t('nav.logs'),
      description: t('dashboard.cta_logs_desc'),
    },
    {
      to: '/system',
      icon: <IconSidebarSystem size={16} />,
      title: t('nav.system_info'),
      description: t('dashboard.cta_system_desc'),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title={t('nav.dashboard')}
        description={t('dashboard.overview_description')}
        meta={
          <>
            {trafficLoading ? (
              <Skeleton width={96} height={22} rounded={999} />
            ) : (
              <span
                className={`${styles.statusPill} ${STATUS_TONE_CLASS[status]}`}
                title={t('dashboard.status_hint')}
              >
                <span className={styles.statusDot} aria-hidden="true" />
                {t(`dashboard.status_${status}`)}
              </span>
            )}
            {versionLabel && <span className={styles.metaVersion}>{versionLabel}</span>}
          </>
        }
        actions={
          <>
            <Link to="/logs" className="btn btn-ghost">
              {t('dashboard.cta_inspect_logs')}
            </Link>
            <Link to="/ai-providers" className="btn btn-secondary">
              {t('dashboard.cta_manage_providers')}
            </Link>
          </>
        }
      />

      <section className={styles.kpiCard} aria-label={t('dashboard.stats_aria')}>
        <dl className={styles.kpiGrid}>
          {kpis.map((kpi) => (
            <div key={kpi.key} className={styles.kpi}>
              <dt className={styles.kpiLabel}>{kpi.label}</dt>
              <dd className={styles.kpiValue}>
                {kpi.loading ? <Skeleton width={72} height={28} rounded={6} /> : kpi.value}
              </dd>
              <dd className={styles.kpiCaption}>
                {kpi.loading ? <Skeleton width="70%" height={12} rounded={4} /> : kpi.caption}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <ThroughputChart traffic={traffic} windowLabel={windowLabel} loading={trafficLoading} />

      <DashboardCard
        title={t('dashboard.fleet_card_title')}
        description={t('dashboard.fleet_description')}
      >
        {trafficLoading ? (
          <SkeletonRows count={3} />
        ) : providers.length === 0 ? (
          <div className={styles.cardBody}>
            <EmptyState title={t('dashboard.fleet_empty')} />
          </div>
        ) : (
          <table className={styles.fleetTable}>
            <thead>
              <tr>
                <th scope="col">{t('dashboard.fleet_col_provider')}</th>
                <th scope="col" className={styles.fleetActivity}>
                  {t('dashboard.fleet_col_activity')}
                </th>
                <th scope="col" className={styles.alignEnd}>
                  {t('dashboard.fleet_col_requests')}
                </th>
                <th scope="col" className={styles.fleetRateHead}>
                  {t('dashboard.success_rate')}
                </th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => {
                const name = providerLabel(provider.id, unknownProviderLabel);
                return (
                  <tr key={provider.id}>
                    <th scope="row">
                      <span className={styles.fleetName}>{name}</span>
                      <span className={styles.fleetMeta}>
                        {t('dashboard.fleet_credentials', { value: provider.credentials })}
                      </span>
                    </th>
                    <td className={styles.fleetActivity}>
                      <Sparkline
                        points={provider.buckets.map((bucket) => bucket.success + bucket.failed)}
                        ariaLabel={t('dashboard.fleet_spark_label', { provider: name })}
                      />
                    </td>
                    <td className={`${styles.alignEnd} ${styles.fleetTotal}`}>
                      {provider.total.toLocaleString()}
                    </td>
                    <td>
                      <div className={styles.fleetRate}>
                        <span className={styles.fleetRateValue}>
                          {provider.successRate === null
                            ? DASH
                            : formatPercent(provider.successRate)}
                        </span>
                        <Meter
                          value={provider.successRate}
                          ariaLabel={t('dashboard.success_rate')}
                          className={styles.fleetMeter}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </DashboardCard>

      <div className={styles.detailGrid}>
        <DashboardCard
          title={t('dashboard.stat_credentials')}
          link={{ to: '/auth-files', label: t('dashboard.health_link') }}
        >
          {loading ? (
            <SkeletonRows count={4} />
          ) : !credentials || credentials.total === 0 ? (
            <div className={styles.cardBody}>
              <EmptyState title={t('dashboard.health_empty')} />
            </div>
          ) : (
            <div className={styles.cardBody}>
              <div className={styles.healthBar} aria-hidden="true">
                {credentialSegments
                  .filter((segment) => segment.count > 0)
                  .map((segment) => (
                    <span
                      key={segment.key}
                      className={`${styles.healthSegment} ${segment.className}`}
                      style={{ flexGrow: segment.count }}
                    />
                  ))}
              </div>
              <ul className={styles.rowList}>
                {credentialSegments.map((segment) => (
                  <li key={segment.key} className={styles.row}>
                    <span className={styles.rowLabel}>
                      <i
                        className={`${styles.legendDot} ${segment.className}`}
                        aria-hidden="true"
                      />
                      {segment.label}
                    </span>
                    <span className={styles.rowValue}>{segment.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <h3 className={styles.subheading}>{t('dashboard.health_by_type')}</h3>
              <ul className={styles.rowList}>
                {credentials.byType.map((entry) => (
                  <li key={entry.type} className={styles.row}>
                    <span className={styles.rowLabel}>
                      {providerLabel(entry.type, unknownProviderLabel)}
                    </span>
                    <span className={styles.rowValue}>{entry.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DashboardCard>

        <DashboardCard
          title={t('dashboard.runtime_card_title')}
          link={{ to: '/config', label: t('dashboard.runtime_link') }}
        >
          {loading ? (
            <SkeletonRows count={6} />
          ) : (
            <div className={styles.cardBody}>
              <dl className={styles.rowList}>
                {runtimeRows.map((row) => (
                  <div key={row.label} className={styles.row}>
                    <dt className={styles.rowLabel}>{row.label}</dt>
                    <dd className={`${styles.rowValue} ${row.mono ? styles.mono : ''}`}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {runtimeToggles.length > 0 && (
                <>
                  <h3 className={styles.subheading}>{t('dashboard.runtime_features')}</h3>
                  <dl className={styles.toggleGrid}>
                    {runtimeToggles.map((toggle) => (
                      <div key={toggle.label} className={styles.row}>
                        <dt className={styles.rowLabel}>{toggle.label}</dt>
                        <dd className={`${styles.toggleState} ${toggle.on ? styles.toggleOn : ''}`}>
                          <i className={styles.toggleDot} aria-hidden="true" />
                          {toggle.on ? t('common.yes') : t('common.no')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </div>
          )}
        </DashboardCard>
      </div>

      <section className={styles.shortcuts} aria-labelledby="dashboard-shortcuts-title">
        <h2 id="dashboard-shortcuts-title" className={styles.sectionTitle}>
          {t('dashboard.shortcuts_title')}
        </h2>
        <div className={styles.shortcutGrid}>
          {shortcuts.map((shortcut) => (
            <Link key={shortcut.to} to={shortcut.to} className={styles.shortcut}>
              <span className={styles.shortcutIcon} aria-hidden="true">
                {shortcut.icon}
              </span>
              <span className={styles.shortcutText}>
                <span className={styles.shortcutTitle}>{shortcut.title}</span>
                <span className={styles.shortcutDescription}>{shortcut.description}</span>
              </span>
              <IconChevronRight size={14} className={styles.shortcutArrow} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
