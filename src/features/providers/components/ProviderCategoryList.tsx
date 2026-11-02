import { useTranslation } from 'react-i18next';
import type { ProviderBrand, ProviderGroup } from '../types';
import { ProviderLogo } from './ProviderLogo';
import styles from './ProviderCategoryList.module.scss';

interface ProviderCategoryListProps {
  groups: ProviderGroup[];
  activeBrand: ProviderBrand;
  onSelect: (brand: ProviderBrand) => void;
}

const QUICK_FILL_BRAND_ORDER: readonly ProviderBrand[] = ['fennoAI', 'qiniuCloud'];

const QUICK_FILL_BRANDS: ReadonlySet<ProviderBrand> = new Set(QUICK_FILL_BRAND_ORDER);

export function ProviderCategoryList({ groups, activeBrand, onSelect }: ProviderCategoryListProps) {
  const { t } = useTranslation();

  const quickFillGroups = groups
    .filter((g) => QUICK_FILL_BRANDS.has(g.id))
    .sort(
      (left, right) =>
        QUICK_FILL_BRAND_ORDER.indexOf(left.id) - QUICK_FILL_BRAND_ORDER.indexOf(right.id)
    );
  const providerGroups = groups
    .filter((g) => !QUICK_FILL_BRANDS.has(g.id))
    .sort((left, right) => Number(right.resources.length > 0) - Number(left.resources.length > 0));

  const renderItem = (group: ProviderGroup) => {
    const active = group.id === activeBrand;
    const total = group.resources.length;
    const activeCount = group.resources.filter((r) => !r.disabled).length;
    const countLabel = activeCount < total ? `${activeCount}/${total}` : String(total);
    const itemClassName = [
      styles.item,
      active ? styles.active : '',
      total === 0 ? styles.unconfigured : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <li key={group.id}>
        <button
          type="button"
          className={itemClassName}
          onClick={() => onSelect(group.id)}
          aria-current={active ? 'page' : undefined}
          title={t('providersPage.categories.activeCount', { active: activeCount, total })}
        >
          <span className={styles.logo}>
            <ProviderLogo brand={group.id} size={16} />
          </span>
          <span className={styles.name}>{t(`providersPage.providerNames.${group.id}`)}</span>
          <span className={styles.count}>{countLabel}</span>
        </button>
      </li>
    );
  };

  return (
    <nav className={styles.nav} aria-label={t('providersPage.categories.title')}>
      <div className={styles.group}>
        <p className={styles.groupLabel}>{t('providersPage.categories.title')}</p>
        <ul className={styles.list}>{providerGroups.map(renderItem)}</ul>
      </div>
      {quickFillGroups.length > 0 ? (
        <div className={styles.group}>
          <p className={styles.groupLabel}>{t('providersPage.categories.quickFill')}</p>
          <ul className={styles.list}>{quickFillGroups.map(renderItem)}</ul>
        </div>
      ) : null}
    </nav>
  );
}
