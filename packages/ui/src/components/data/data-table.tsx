import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import styles from './data.module.css';

export interface DataColumn<Row> {
  readonly key: string;
  readonly header: ReactNode;
  readonly cell: (row: Row) => ReactNode;
  /** Numbers align right in tabular figures, so columns of them can be compared. */
  readonly numeric?: boolean;
  /** The column that names the row stays in view while the rest scrolls. */
  readonly sticky?: boolean;
}

export interface DataTableProps<Row> {
  /** What the table shows, for assistive technology. */
  readonly caption: string;
  readonly columns: readonly DataColumn<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  readonly onRowClick?: (row: Row) => void;
  /** A summary row under the data, e.g. totals. */
  readonly footer?: Row;
  readonly className?: string | undefined;
}

/**
 * Rows of figures on one surface. It scrolls inside itself when the screen is
 * narrower than its columns, so the page never does.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  onRowClick,
  footer,
  className,
}: DataTableProps<Row>) {
  const cellClass = (column: DataColumn<Row>) =>
    clsx(column.numeric && styles.numeric, column.sticky && styles.sticky);
  return (
    <div className={clsx(styles.tableFrame, className)}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cellClass(column)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={clsx(onRowClick && styles.clickable)}
              onClick={
                onRowClick
                  ? () => {
                      onRowClick(row);
                    }
                  : undefined
              }
            >
              {columns.map((column, index) =>
                index === 0 && onRowClick ? (
                  <th key={column.key} scope="row" className={cellClass(column)}>
                    <button
                      type="button"
                      className={styles.rowButton}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRowClick(row);
                      }}
                    >
                      {column.cell(row)}
                    </button>
                  </th>
                ) : (
                  <td key={column.key} className={cellClass(column)}>
                    {column.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot>
            <tr>
              {columns.map((column) => (
                <td key={column.key} className={cellClass(column)}>
                  {column.cell(footer)}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
