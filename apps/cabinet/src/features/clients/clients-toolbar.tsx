import { clientSorts } from '@mestechko/contracts/client';
import { SegmentedControl, Select, TextField } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { useClientTags, type ClientSort } from '../../platform/api/clients-queries';
import styles from './clients.module.css';

const ALL_TAGS = '';

export interface ClientsToolbarProps {
  readonly businessId: string;
  readonly search: string;
  readonly tag: string | null;
  readonly sort: ClientSort;
  readonly onSearch: (search: string) => void;
  readonly onTag: (tag: string | null) => void;
  readonly onSort: (sort: ClientSort) => void;
}

/** Search by name, phone or e-mail, a tag filter with counts and the order of the list. */
export function ClientsToolbar({
  businessId,
  search,
  tag,
  sort,
  onSearch,
  onTag,
  onSort,
}: ClientsToolbarProps) {
  const { t } = useTranslation();
  const tags = useClientTags(businessId).data?.tags ?? [];
  // A tag from a shared link stays selectable while the counts load or after it is gone.
  const options = [
    { value: ALL_TAGS, label: t('clients:toolbar.allTags') },
    ...(tag && !tags.some((entry) => entry.tag === tag) ? [{ value: tag, label: tag }] : []),
    ...tags.map((entry) => ({
      value: entry.tag,
      label: t('clients:toolbar.tagOption', { tag: entry.tag, count: entry.clients }),
    })),
  ];
  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <TextField
          label={t('clients:toolbar.search')}
          type="search"
          placeholder={t('clients:toolbar.searchPlaceholder')}
          value={search}
          onChange={(event) => {
            onSearch(event.target.value);
          }}
        />
      </div>
      <Select
        className={styles.tagFilter}
        label={t('clients:toolbar.tag')}
        value={tag ?? ALL_TAGS}
        options={options}
        onChange={(value) => {
          onTag(value === ALL_TAGS ? null : value);
        }}
      />
      <div className={styles.sort}>
        <SegmentedControl<ClientSort>
          label={t('clients:toolbar.sort')}
          value={sort}
          segments={clientSorts.map((id) => ({ value: id, label: t(`clients:sort.${id}`) }))}
          onChange={onSort}
        />
      </div>
    </div>
  );
}
