import { errorMessage, LanguageList, storedLocale, useLocale } from '@mestechko/booking-ui';
import { Sheet, useToast } from '@mestechko/ui';
import type { Locale } from '@mestechko/domain';
import { useEffect, useEffectEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences, useSaveLocale } from '../../platform/api/preference-queries';
import { useSettingsButton } from '../../platform/telegram/sdk-buttons';

/**
 * Keeps the app's language in step with the person's choice on the server, which the
 * bot writes in as well: a choice kept there wins over this device, and a choice made
 * on this device that the server lacks is saved there.
 */
function usePreferenceSync() {
  const { locale, changeLocale } = useLocale();
  const preferences = usePreferences(true);
  const save = useSaveLocale();
  const chosen = preferences.data?.locale;
  // Reacts to the server's answer, not to every switch made here.
  const reconcile = useEffectEvent((serverChoice: Locale | null) => {
    if (serverChoice !== null && serverChoice !== locale) {
      changeLocale(serverChoice);
    }
    const local = storedLocale();
    if (serverChoice === null && local !== null && !save.isPending) {
      save.mutate(local);
    }
  });
  useEffect(() => {
    if (chosen !== undefined) {
      reconcile(chosen);
    }
  }, [chosen]);
  return save;
}

/** The app's own settings, opened from «Settings» in Telegram's menu of the app. */
export function SettingsSheet() {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const save = usePreferenceSync();
  useSettingsButton(() => {
    setOpen(true);
  });
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={t('settings.title')}
      closeLabel={t('common:actions.close')}
    >
      <LanguageList
        onChanged={(locale) => {
          save.mutate(locale, {
            onError: (error) => {
              toast.show({ title: errorMessage(t, error), tone: 'error' });
            },
          });
        }}
      />
    </Sheet>
  );
}
