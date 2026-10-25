import { localeIds, type Locale } from '@mestechko/domain';
import { ChoiceMenu, ListGroup, ListItem } from '@mestechko/ui';
import { Check, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { languageCode, languageName } from './language-name';
import { useLocale } from './use-locale';

export interface LanguageSwitchProps {
  /** Runs after the switch, e.g. to keep the choice on the server as well. */
  readonly onChanged?: (locale: Locale) => void;
}

/** The language in a header: a compact button with the languages in a menu. */
export function LanguageMenu({ onChanged }: LanguageSwitchProps) {
  const { t } = useTranslation();
  const { locale, changeLocale } = useLocale();
  return (
    <ChoiceMenu
      label={t('common:language.change')}
      icon={<Languages />}
      current={languageCode(locale)}
      value={locale}
      options={localeIds.map((id) => ({ value: id, label: languageName(id), lang: id }))}
      onChange={(next) => {
        changeLocale(next);
        onChanged?.(next);
      }}
    />
  );
}

/** The language in a settings sheet: the languages as a list with the current one marked. */
export function LanguageList({ onChanged }: LanguageSwitchProps) {
  const { t } = useTranslation();
  const { locale, changeLocale } = useLocale();
  return (
    <ListGroup title={t('common:language.label')}>
      {localeIds.map((id) => (
        <ListItem
          key={id}
          title={<span lang={id}>{languageName(id)}</span>}
          selected={id === locale}
          trailing={id === locale ? <Check /> : undefined}
          onClick={() => {
            changeLocale(id);
            onChanged?.(id);
          }}
        />
      ))}
    </ListGroup>
  );
}
