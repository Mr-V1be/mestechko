import { Combobox } from '@base-ui/react/combobox';
import { clsx } from 'clsx';
import { Check, Plus, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import formStyles from './form.module.css';
import styles from './tag-input.module.css';

/** Words the control needs from the product, in its language. */
export interface TagInputTexts {
  /** Accessible name of a tag's remove button, e.g. «Убрать тег VIP». */
  readonly remove: (tag: string) => string;
  /** Option that adds what was typed as a new tag, e.g. «Добавить «VIP»». */
  readonly create: (tag: string) => string;
}

export interface TagInputProps {
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly value: readonly string[];
  readonly onChange: (value: string[]) => void;
  /** Tags already in use, offered while typing. */
  readonly suggestions?: readonly string[];
  readonly placeholder?: string;
  readonly description?: ReactNode;
  readonly error?: string | null;
  readonly maxLength?: number;
  readonly maxCount?: number;
  readonly texts: TagInputTexts;
  /** `inline` blends into the content around it until focused, e.g. on a profile. */
  readonly appearance?: 'field' | 'inline';
  readonly disabled?: boolean;
}

const sameTag = (left: string, right: string) =>
  left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;

/** Tags without repeats that differ only in case, in the order they came. */
function distinct(tags: readonly string[]): string[] {
  const result: string[] = [];
  for (const tag of tags.map((value) => value.trim()).filter(Boolean)) {
    if (!result.some((kept) => sameTag(kept, tag))) {
      result.push(tag);
    }
  }
  return result;
}

/**
 * Free-form labels: chips with a remove button and an input that suggests known tags
 * and turns anything new into a tag on Enter.
 */
export function TagInput({
  label,
  hideLabel = false,
  value,
  onChange,
  suggestions = [],
  placeholder,
  description,
  error,
  maxLength,
  maxCount,
  texts,
  appearance = 'field',
  disabled = false,
}: TagInputProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const typed = query.trim();
  const known = distinct([...value, ...suggestions]);
  const isNew = typed !== '' && !known.some((tag) => sameTag(tag, typed));
  const items = isNew ? [...known, typed] : known;
  const full = maxCount !== undefined && value.length >= maxCount;
  const invalid = Boolean(error);
  return (
    <Combobox.Root
      items={items}
      multiple
      autoHighlight
      disabled={disabled}
      value={[...value]}
      onValueChange={(next: string[]) => {
        const tags = distinct(next);
        if (maxCount !== undefined && tags.length > Math.max(maxCount, value.length)) {
          return;
        }
        onChange(tags);
        setQuery('');
      }}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <div className={formStyles.field}>
        <label htmlFor={id} className={clsx(formStyles.label, hideLabel && 'visually-hidden')}>
          {label}
        </label>
        <Combobox.InputGroup
          className={clsx(
            styles.group,
            appearance === 'inline' && styles.inline,
            invalid && styles.invalid,
          )}
        >
          <Combobox.Chips className={styles.chips}>
            {value.map((tag) => (
              <Combobox.Chip key={tag} className={styles.chip} aria-label={tag}>
                <span className={styles.chipText}>{tag}</span>
                <Combobox.ChipRemove className={styles.chipRemove} aria-label={texts.remove(tag)}>
                  <X aria-hidden="true" />
                </Combobox.ChipRemove>
              </Combobox.Chip>
            ))}
            {full ? null : (
              <span className={styles.entry}>
                {appearance === 'inline' ? <Plus aria-hidden="true" /> : null}
                <Combobox.Input
                  id={id}
                  className={styles.input}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  aria-invalid={invalid || undefined}
                />
              </span>
            )}
          </Combobox.Chips>
        </Combobox.InputGroup>
        {description && !invalid ? <p className={formStyles.description}>{description}</p> : null}
        {invalid ? (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Combobox.Portal>
        <Combobox.Positioner
          className={styles.positioner}
          sideOffset={4}
          align="start"
          style={{ zIndex: 'var(--layer-popover)' }}
        >
          <Combobox.Popup className={clsx(formStyles.popup, styles.popup)}>
            <Combobox.List>
              {(tag: string) => (
                <Combobox.Item key={tag} value={tag} className={formStyles.item}>
                  {isNew && tag === typed ? (
                    <>
                      <span className={styles.itemIcon}>
                        <Plus aria-hidden="true" />
                      </span>
                      <span className={formStyles.itemText}>{texts.create(tag)}</span>
                    </>
                  ) : (
                    <>
                      <span className={formStyles.itemText}>{tag}</span>
                      <Combobox.ItemIndicator className={formStyles.itemIndicator}>
                        <Check />
                      </Combobox.ItemIndicator>
                    </>
                  )}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
