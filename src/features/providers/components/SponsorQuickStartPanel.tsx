import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useNotificationStore } from '@/stores';
import { Button } from '@/components/ui/Button';
import { IconExternalLink, IconPlus } from '@/components/ui/icons';
import {
  APIKEY_FUN_AFFILIATE_URL,
  APIKEY_FUN_DASHBOARD_URL,
  APIKEY_FUN_DISPLAY_NAME,
} from '../sponsor';
import { isSponsorPartialMutationError } from '../sponsorMutationRecovery';
import type { ProviderEntryFormInput, ProviderResource } from '../types';
import type { UseProviderWorkbenchResult } from '../useProviderWorkbench';
import { SponsorProviderForm } from '../sheets/forms/SponsorProviderForm';
import { ProviderLogo } from './ProviderLogo';
import styles from './SponsorQuickStartPanel.module.scss';

interface SponsorQuickStartPanelProps {
  resource: ProviderResource | null;
  workbench: UseProviderWorkbenchResult;
  mutationDisabled?: boolean;
}

export function SponsorQuickStartPanel({
  resource,
  workbench,
  mutationDisabled = false,
}: SponsorQuickStartPanelProps) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const formId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const formMutating = submitting || mutationDisabled || workbench.mutating;
  const mode = resource ? 'edit' : 'create';
  const submitDisabled = formMutating || (mode === 'edit' && !isDirty);

  useUnsavedChangesGuard({
    shouldBlock: isDirty && !submitting,
    dialog: {
      title: t('providersPage.unsavedChanges.title'),
      message: t('providersPage.unsavedChanges.message'),
      confirmText: t('providersPage.unsavedChanges.discard'),
      cancelText: t('providersPage.unsavedChanges.keepEditing'),
      variant: 'danger',
    },
  });

  const handleSubmit = async (input: ProviderEntryFormInput) => {
    if (mutationDisabled) return;
    setSubmitting(true);
    try {
      if (resource) {
        await workbench.updateProvider(resource, input);
        showNotification(t('providersPage.toast.updated'), 'success');
      } else {
        await workbench.createProvider('apikeyFun', input);
        showNotification(t('providersPage.toast.created'), 'success');
        setShowCreateForm(false);
      }
      setIsDirty(false);
      setFormVersion((current) => current + 1);
    } catch (err) {
      if (isSponsorPartialMutationError(err)) {
        showNotification(t('providersPage.sponsor.partialMutationWarning'), 'warning');
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(
        `${t(resource ? 'notification.update_failed' : 'notification.add_failed')}: ${msg}`,
        'error'
      );
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const identity = (
    <div className={styles.identity}>
      <span className={styles.logo}>
        <ProviderLogo brand="apikeyFun" size={32} />
      </span>
      <div className={styles.identityText}>
        <h2 className={styles.title}>{t('providersPage.providerNames.apikeyFun')}</h2>
        <p className={styles.subtitle}>{t('providersPage.sponsor.protocolSummary')}</p>
      </div>
    </div>
  );

  if (!resource && !showCreateForm) {
    const steps = ['register', 'createKey', 'addKey'] as const;
    return (
      <section className={styles.panel}>
        <div className={styles.onboarding}>
          {identity}
          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step} className={styles.step}>
                <span className={styles.stepIndex} aria-hidden="true">
                  {index + 1}
                </span>
                <span>
                  {t(`providersPage.quickStart.steps.${step}`, {
                    provider: APIKEY_FUN_DISPLAY_NAME,
                  })}
                </span>
              </li>
            ))}
          </ol>
          <div className={styles.onboardingActions}>
            <a
              className="btn btn-secondary"
              href={APIKEY_FUN_AFFILIATE_URL}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                {t('providersPage.sponsor.registerNow')}
                <IconExternalLink size={14} />
              </span>
            </a>
            <Button type="button" onClick={() => setShowCreateForm(true)} disabled={formMutating}>
              <IconPlus size={14} />
              {t('providersPage.quickStart.addKey')}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const actionHref = resource ? APIKEY_FUN_DASHBOARD_URL : APIKEY_FUN_AFFILIATE_URL;
  const actionLabel = resource
    ? t('providersPage.sponsor.dashboardLink')
    : t('providersPage.sponsor.registerLink');

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        {identity}
        <a className="btn btn-ghost btn-sm" href={actionHref} target="_blank" rel="noreferrer">
          <span>
            {actionLabel}
            <IconExternalLink size={14} />
          </span>
        </a>
      </header>

      <div className={styles.body}>
        <SponsorProviderForm
          key={`${mode}:${resource?.id ?? 'new'}:${formVersion}`}
          resource={resource}
          mode={mode}
          mutating={formMutating}
          formId={formId}
          onSubmit={handleSubmit}
          onDirtyChange={setIsDirty}
        />
      </div>

      <footer className={styles.footer}>
        {!resource ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setShowCreateForm(false);
              setIsDirty(false);
              setFormVersion((current) => current + 1);
            }}
            disabled={submitting}
          >
            {t('providersPage.actions.cancel')}
          </Button>
        ) : null}
        <Button type="submit" form={formId} disabled={submitDisabled} loading={submitting}>
          {mode === 'create' ? t('providersPage.actions.create') : t('providersPage.actions.save')}
        </Button>
      </footer>
    </section>
  );
}
