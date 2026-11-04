import { ReactNode } from "react";
import { TableFrame } from "./TableFrame";

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
}

export function Table<T>({ columns, data, keyExtractor }: TableProps<T>) {
  return (
    <TableFrame>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-mist">
            {columns.map((col) => (
              <th key={col.key} className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wider">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={keyExtractor(item)} className="border-b border-slate-100 transition-colors hover:bg-mist">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3">
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
