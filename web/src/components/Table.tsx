interface TableProps<T> {
  columns: { key: keyof T; label: string }[];
  data: T[];
  keyField: keyof T;
}

const Table = <T extends Record<string, any>>({ columns, data, keyField }: TableProps<T>) => {
  return (
    <div className="overflow-hidden rounded-lg border border-border-gold/60 bg-white shadow-soft">
      <table className="min-w-full divide-y divide-border-gold/40">
        <thead className="bg-brand-200/60">
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-ink">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-sm">
          {data.map((row) => (
            <tr
              key={String(row[keyField])}
              className="border-b border-border-gold/40 last:border-b-0 hover:bg-brand-200/30"
            >
              {columns.map((col) => (
                <td key={String(col.key)} className="px-4 py-3 text-text-ink">
                  {String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && <p className="p-4 text-sm text-text-ink/70">No records found.</p>}
    </div>
  );
};

export default Table;
