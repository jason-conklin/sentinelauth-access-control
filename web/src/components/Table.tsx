interface TableProps<T> {
  columns: { key: keyof T; label: string }[];
  data: T[];
  keyField: keyof T;
}

const Table = <T extends Record<string, any>>({ columns, data, keyField }: TableProps<T>) => {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
      <table className="min-w-full divide-y divide-slate-800">
        <thead className="bg-slate-900/70">
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-400">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-sm">
          {data.map((row) => (
            <tr key={String(row[keyField])} className="hover:bg-slate-800/50">
              {columns.map((col) => (
                <td key={String(col.key)} className="px-4 py-3 text-slate-200">
                  {String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && <p className="p-4 text-sm text-slate-400">No records found.</p>}
    </div>
  );
};

export default Table;
