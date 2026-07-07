import Spinner from "./Spinner.jsx";

/**
 * Generic table card.
 * columns: [{ key, header, render?(row), className? }]
 * states: loading / error / empty handled internally.
 */
export default function DataTable({
  columns,
  rows,
  isLoading,
  isError,
  emptyMessage = "Nothing here yet.",
  errorMessage = "Backend offline.",
  rowKey = (r, i) => i,
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-mist/70">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-subtle"
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  <Spinner className="mx-auto" />
                </td>
              </tr>
            )}
            {!isLoading && isError && (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-danger">
                  {errorMessage}
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows?.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-subtle">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!isLoading &&
              !isError &&
              rows?.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  className="border-t border-hairline transition-colors hover:bg-mist/40"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3 text-sm ${c.className || ""}`}
                    >
                      {c.render ? c.render(row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
