import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconExternalLink, IconPlus, IconSearch } from '@/components/ui/icons';
import type { ProviderRecentUsageMap } from '@/components/providers/utils';
import { getKimiAffiliateUrl } from '../kimi';
import { getSponsorProviderDefinition } from '../sponsorDefinitions';
import type { ProviderGroup, ProviderResource, ProviderSortBy, SortDir } from '../types';
import { ProviderLogo } from './ProviderLogo';
import { ProviderResourceTable } from './ProviderResourceTable';
import { ProviderResourceToolbar } from './ProviderResourceToolbar';
import styles from './ProviderResourcePanel.module.scss';

export interface ProviderPanelControls {
  sortBy: ProviderSortBy;
  sortDir: SortDir;
  onSortBy: (value: ProviderSortBy) => void;
  onSortDir: (value: SortDir) => void;
  availableModels: ReadonlyArray<string>;
  selectedModels: ReadonlySet<string>;
  onSelectedModelsChange: (next: Set<string>) => void;
}

interface ProviderResourcePanelProps {
  group: ProviderGroup;
  filter: string;
  onFilterChange: (value: string) => void;
  onClearFilters: () => void;
  filteredResources: ProviderResource[];
  selectedId: string | null;
  disableMutations?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  toolbarControls?: ProviderPanelControls;
  onView: (resource: ProviderResource) => void;
  onEdit: (resource: ProviderResource) => void;
  onDelete: (resource: ProviderResource) => void;
  onToggleDisabled?: (resource: ProviderResource, disabled: boolean) => void;
  onCreate: () => void;
}

export function ProviderResourcePanel({
  group,
  filter,
  onFilterChange,
  onClearFilters,
  filteredResources,
  selectedId,
  disableMutations,
  usageByProvider,
  toolbarControls,
  onView,
  onEdit,
  onDelete,
  onToggleDisabled,
  onCreate,
}: ProviderResourcePanelProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const providerTitle = t(`providersPage.providerNames.${group.id}`);
  const total = group.resources.length;
  const activeCount = group.resources.filter((r) => !r.disabled).length;
  const registrationUrl =
    group.id === 'kimi'
      ? getKimiAffiliateUrl(i18n.resolvedLanguage ?? i18n.language)
      : group.id === 'fennoAI' || group.id === 'qiniuCloud'
        ? getSponsorProviderDefinition(group.id).affiliateUrl
        : null;
  const registrationLabel = t(
    group.id === 'kimi' ? 'providersPage.sponsor.registerNow' : 'providersPage.sponsor.registerLink'
  );

  const registrationLink = registrationUrl ? (
    <a className="btn btn-secondary btn-sm" href={registrationUrl} target="_blank" rel="noreferrer">
      <span>
        {registrationLabel}
        <IconExternalLink size={14} />
      </span>
    </a>
  ) : null;

  const renderContent = () => {
    if (total === 0) {
      return (
        <EmptyState
          title={t('providersPage.empty.title', { provider: providerTitle })}
          description={t('providersPage.empty.description', { provider: providerTitle })}
          action={
            <div className={styles.emptyActions}>
              <Button type="button" size="sm" onClick={onCreate} disabled={disableMutations}>
                <IconPlus size={14} />
                {t('providersPage.empty.add', { provider: providerTitle })}
              </Button>
              {registrationLink}
            </div>
          }
        />
      );
    }
    if (filteredResources.length === 0) {
      return (
        <EmptyState
          title={t('providersPage.empty.noMatchTitle')}
          description={t('providersPage.empty.noMatchDescription')}
          action={
            <Button type="button" variant="secondary" size="sm" onClick={onClearFilters}>
              {t('providersPage.actions.clearFilters')}
            </Button>
          }
        />
      );
    }
    return (
      <ProviderResourceTable
        resources={filteredResources}
        selectedId={selectedId}
        disableMutations={disableMutations}
        usageByProvider={usageByProvider}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleDisabled={onToggleDisabled}
      />
    );
  };

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.logo}>
            <ProviderLogo brand={group.id} size={20} />
          </span>
          <h2 id={titleId} className={styles.title}>
            {providerTitle}
          </h2>
          {total > 0 ? (
            <span className={styles.count}>
              {t('providersPage.categories.activeCount', { active: activeCount, total })}
            </span>
          ) : null}
        </div>
        {total > 0 ? registrationLink : null}
      </header>

      {group.id === 'kimi' ? (
        <p className={styles.promo}>{t('providersPage.sponsor.kimiPromo')}</p>
      ) : null}

      {total > 0 ? (
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <span className={styles.searchIcon} aria-hidden="true">
              <IconSearch size={14} />
            </span>
            <input
              type="search"
              className={styles.searchInput}
              value={filter}
              onChange={(event) => onFilterChange(event.target.value)}
              placeholder={t('providersPage.table.filterPlaceholder')}
              aria-label={t('providersPage.table.filterPlaceholder')}
            />
          </label>
          {toolbarControls ? (
            <ProviderResourceToolbar
              key={group.id}
              sortBy={toolbarControls.sortBy}
              sortDir={toolbarControls.sortDir}
              onSortBy={toolbarControls.onSortBy}
              onSortDir={toolbarControls.onSortDir}
              availableModels={toolbarControls.availableModels}
              selectedModels={toolbarControls.selectedModels}
              onSelectedModelsChange={toolbarControls.onSelectedModelsChange}
            />
          ) : null}
        </div>
      ) : null}

      {renderContent()}
    </section>
  );
}
