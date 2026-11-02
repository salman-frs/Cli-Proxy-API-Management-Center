import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapsible } from '@/components/ui/Collapsible';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatPercent } from '@/utils/format';
import { TRAFFIC_BUCKET_MINUTES, type TrafficWindow } from '../types';
import { axisMax } from '../utils';
import styles from './ThroughputChart.module.scss';

/** 纵轴刻度条数（含 0），即 TICK_COUNT - 1 个间隔 */
const TICK_COUNT = 5;
const X_TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

/**
 * 桶时间标签。后端返回的是服务器本地时间字符串（"15:04-15:14"），
 * 优先使用它，而不是用浏览器时钟反推，避免时区不一致。
 */
function bucketRangeLabel(time: string | undefined, index: number, count: number): string {
  if (time) return time;
  const minutesAgo = (count - index) * TRAFFIC_BUCKET_MINUTES;
  return `-${minutesAgo}m`;
}

function bucketStartLabel(time: string | undefined, index: number, count: number): string {
  if (!time) return bucketRangeLabel(time, index, count);
  const [start] = time.split('-');
  return start?.trim() || time;
}

function tooltipShift(index: number, count: number): string {
  if (index < count * 0.15) return 'translateX(-12%)';
  if (index > count * 0.85) return 'translateX(-88%)';
  return 'translateX(-50%)';
}

interface ThroughputChartProps {
  traffic: TrafficWindow;
  windowLabel: string;
  loading: boolean;
}

export function ThroughputChart({ traffic, windowLabel, loading }: ThroughputChartProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { buckets, totalSuccess, totalFailure, total, peakIndex, peakTotal } = traffic;
  const hasBuckets = buckets.length > 0;
  const scaleMax = useMemo(() => axisMax(peakTotal, TICK_COUNT - 1), [peakTotal]);

  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, index) => {
        const ratio = 1 - index / (TICK_COUNT - 1);
        return { ratio, value: Math.round(scaleMax * ratio) };
      }),
    [scaleMax]
  );

  const xAxisTicks = useMemo(() => {
    if (buckets.length === 0) return [];
    const positions = X_TICK_FRACTIONS.map((fraction) =>
      Math.round(fraction * (buckets.length - 1))
    );
    return Array.from(new Set(positions)).map((index) => ({
      index,
      label: bucketStartLabel(buckets[index]?.time, index, buckets.length),
    }));
  }, [buckets]);

  const summary = t('dashboard.traffic_chart_summary', {
    total,
    success: totalSuccess,
    failed: totalFailure,
    minutes: traffic.windowMinutes,
  });

  const activeBucket = activeIndex === null ? null : buckets[activeIndex];
  const activeTotal = activeBucket ? activeBucket.success + activeBucket.failed : 0;

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {t('dashboard.traffic_card_title')}
          </h2>
          <p className={styles.description}>
            {t('dashboard.traffic_card_description', { window: windowLabel })}
          </p>
        </div>
        {hasBuckets && !loading && (
          <ul className={styles.legend}>
            <li className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchSuccess}`} aria-hidden="true" />
              {t('stats.success')}
              <b className={styles.legendValue}>{totalSuccess.toLocaleString()}</b>
            </li>
            <li className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swatchFailure}`} aria-hidden="true" />
              {t('stats.failure')}
              <b className={styles.legendValue}>{totalFailure.toLocaleString()}</b>
            </li>
          </ul>
        )}
      </header>

      {loading ? (
        <div className={styles.body}>
          <Skeleton className={styles.skeleton} />
        </div>
      ) : !hasBuckets ? (
        <div className={styles.body}>
          <EmptyState
            title={t('dashboard.traffic_unavailable')}
            description={t('dashboard.traffic_unavailable_hint')}
          />
        </div>
      ) : (
        <>
          <figure className={styles.chart}>
            <div className={styles.plot}>
              <div className={styles.yAxis} aria-hidden="true">
                {ticks.map((tick) => (
                  <span
                    key={tick.ratio}
                    className={styles.yTick}
                    style={{ top: `${(1 - tick.ratio) * 100}%` }}
                  >
                    {tick.value.toLocaleString()}
                  </span>
                ))}
              </div>

              <div className={styles.canvas}>
                <div className={styles.gridlines} aria-hidden="true">
                  {ticks.map((tick) => (
                    <span
                      key={tick.ratio}
                      className={styles.gridline}
                      style={{ top: `${(1 - tick.ratio) * 100}%` }}
                    />
                  ))}
                </div>

                <div
                  className={styles.columns}
                  role="img"
                  aria-label={summary}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {buckets.map((bucket, index) => {
                    const bucketTotal = bucket.success + bucket.failed;
                    const hasBoth = bucket.success > 0 && bucket.failed > 0;

                    return (
                      <div
                        key={bucket.time ?? index}
                        className={`${styles.column} ${activeIndex === index ? styles.columnActive : ''}`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() =>
                          setActiveIndex((current) => (current === index ? null : index))
                        }
                      >
                        {index === peakIndex && peakTotal > 0 && (
                          <span
                            className={styles.peakLabel}
                            style={{
                              bottom: `${Math.min(100, (bucketTotal / scaleMax) * 100)}%`,
                            }}
                          >
                            {peakTotal.toLocaleString()}
                          </span>
                        )}
                        <div className={styles.stack}>
                          {bucket.failed > 0 && (
                            <span
                              className={`${styles.segment} ${styles.segmentFailure} ${
                                hasBoth ? styles.segmentGap : ''
                              }`}
                              style={{ height: `${(bucket.failed / scaleMax) * 100}%` }}
                            />
                          )}
                          {bucket.success > 0 && (
                            <span
                              className={`${styles.segment} ${styles.segmentSuccess} ${
                                bucket.failed > 0 ? styles.segmentSquareTop : ''
                              }`}
                              style={{ height: `${(bucket.success / scaleMax) * 100}%` }}
                            />
                          )}
                          {bucketTotal === 0 && <span className={styles.idleTick} />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {total === 0 && <p className={styles.noRequests}>{t('status_bar.no_requests')}</p>}

                {activeBucket && activeIndex !== null && (
                  <div
                    className={styles.tooltip}
                    style={{
                      left: `${((activeIndex + 0.5) / buckets.length) * 100}%`,
                      transform: tooltipShift(activeIndex, buckets.length),
                    }}
                    role="status"
                  >
                    <span className={styles.tooltipTime}>
                      {bucketRangeLabel(activeBucket.time, activeIndex, buckets.length)}
                    </span>
                    <span className={styles.tooltipRow}>
                      <span
                        className={`${styles.swatch} ${styles.swatchSuccess}`}
                        aria-hidden="true"
                      />
                      {t('stats.success')}
                      <b>{activeBucket.success.toLocaleString()}</b>
                    </span>
                    <span className={styles.tooltipRow}>
                      <span
                        className={`${styles.swatch} ${styles.swatchFailure}`}
                        aria-hidden="true"
                      />
                      {t('stats.failure')}
                      <b>{activeBucket.failed.toLocaleString()}</b>
                    </span>
                    <span className={styles.tooltipRate}>
                      {activeTotal > 0
                        ? `${t('dashboard.success_rate')} ${formatPercent((activeBucket.success / activeTotal) * 100)}`
                        : t('status_bar.no_requests')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.xAxis} aria-hidden="true">
              {xAxisTicks.map((tick) => (
                <span
                  key={tick.index}
                  className={styles.xTick}
                  style={{ left: `${((tick.index + 0.5) / buckets.length) * 100}%` }}
                >
                  {tick.label}
                </span>
              ))}
            </div>
          </figure>

          <Collapsible className={styles.tableToggle} label={t('dashboard.traffic_table')} flush>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t('dashboard.traffic_table_window')}</th>
                    <th scope="col">{t('stats.success')}</th>
                    <th scope="col">{t('stats.failure')}</th>
                    <th scope="col">{t('dashboard.success_rate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((bucket, index) => {
                    const bucketTotal = bucket.success + bucket.failed;
                    return (
                      <tr key={bucket.time ?? index}>
                        <th scope="row">{bucketRangeLabel(bucket.time, index, buckets.length)}</th>
                        <td>{bucket.success.toLocaleString()}</td>
                        <td>{bucket.failed.toLocaleString()}</td>
                        <td>
                          {bucketTotal > 0
                            ? formatPercent((bucket.success / bucketTotal) * 100)
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Collapsible>
        </>
      )}
    </section>
  );
}
