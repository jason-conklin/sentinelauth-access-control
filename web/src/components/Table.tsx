import { ReactNode, useMemo, useState } from "react";

type SortDirection = "asc" | "desc";

export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  comparator?: (a: T, b: T) => number;
  render?: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyField: keyof T;
  initialSort?: { key: keyof T; direction?: SortDirection };
}

const compareValues = (a: unknown, b: unknown): number => {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  const typeA = typeof a;
  const typeB = typeof b;

  if (typeA === "number" && typeB === "number") {
    return (a as number) - (b as number);
  }

  if (typeA === "boolean" && typeB === "boolean") {
    return (a === b ? 0 : a ? 1 : -1);
  }

  const stringA = String(a).toLocaleLowerCase();
  const stringB = String(b).toLocaleLowerCase();
  return stringA.localeCompare(stringB);
};

const formatValue = (value: unknown): ReactNode => {
  if (value == null || value === "") return "\u2014";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const Table = <T extends Record<string, any>>({
  columns,
  data,
  keyField,
  initialSort,
}: TableProps<T>) => {
  const [sortState, setSortState] = useState<
    { key: keyof T; direction: SortDirection } | null
  >(
    initialSort
      ? { key: initialSort.key, direction: initialSort.direction ?? "asc" }
      : null
  );

  const sortedData = useMemo(() => {
    if (!sortState) return data;
    const column = columns.find((col) => col.key === sortState.key);
    if (!column) return data;

    const comparator =
      column.comparator ?? ((a: T, b: T) => compareValues(a[column.key], b[column.key]));

    const items = [...data];
    items.sort((a, b) => {
      const result = comparator(a, b);
      return sortState.direction === "asc" ? result : -result;
    });
    return items;
  }, [data, columns, sortState]);

  const handleSort = (column: TableColumn<T>) => {
    if (!column.sortable) return;
    setSortState((prev) => {
      if (prev?.key === column.key) {
        const nextDirection = prev.direction === "asc" ? "desc" : "asc";
        return { key: column.key, direction: nextDirection };
      }
      return { key: column.key, direction: "asc" };
    });
  };

  const renderIndicator = (column: TableColumn<T>) => {
    if (!column.sortable) return null;
    if (sortState?.key !== column.key) {
      return <span className="ml-1 text-text-ink/40">{'\u2195'}</span>;
    }
    return (
      <span className="ml-1 text-text-ink/80">
        {sortState.direction === "asc" ? '\u2191' : '\u2193'}
      </span>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border-gold/60 bg-white shadow-soft">
      <table className="min-w-full divide-y divide-border-gold/40">
        <thead className="bg-brand-200/60">
          <tr>
            {columns.map((col) => {
              const isSorted = sortState?.key === col.key;
              const ariaSort = col.sortable
                ? isSorted
                  ? sortState?.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
                : undefined;
              return (
                <th
                  key={String(col.key)}
                  aria-sort={ariaSort as any}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-ink"
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase text-text-ink transition hover:text-text-ink/70"
                    >
                      {col.label}
                      {renderIndicator(col)}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="text-sm">
          {sortedData.map((row) => (
            <tr
              key={String(row[keyField])}
              className="border-b border-border-gold/40 last:border-b-0 hover:bg-brand-200/30"
            >
              {columns.map((col) => (
                <td key={String(col.key)} className="px-4 py-3 text-text-ink">
                  {col.render ? col.render(row) : formatValue(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sortedData.length === 0 && (
        <p className="p-4 text-sm text-text-ink/70">No records found.</p>
      )}
    </div>
  );
};

export default Table;
