export type ExcelPasteSampleColumn = {
  key: string
  label: string
  required?: boolean
}

type ExcelPasteSampleTableProps = {
  columns: readonly ExcelPasteSampleColumn[]
  /** 데이터 예시 행. 문자열 한 줄이면 1행, 여러 줄이면 2행부터 표시 */
  sampleRows: readonly (readonly string[])[] | readonly string[]
  emptyCell?: string
}

function normalizeSampleRows(
  columns: readonly ExcelPasteSampleColumn[],
  sampleRows: ExcelPasteSampleTableProps['sampleRows'],
): string[][] {
  if (!sampleRows.length) return []
  const first = sampleRows[0]
  if (typeof first === 'string') {
    return [sampleRows as string[]]
  }
  return (sampleRows as readonly (readonly string[])[]).map((row) => {
    const cells = [...row]
    while (cells.length < columns.length) cells.push('')
    return cells.slice(0, columns.length)
  })
}

/** 품목 일괄등록과 같은 엑셀형(열문자·행번호) 붙여넣기 예시 */
export function ExcelPasteSampleTable({
  columns,
  sampleRows,
  emptyCell = '—',
}: ExcelPasteSampleTableProps) {
  const rows = normalizeSampleRows(columns, sampleRows)

  return (
    <div className="mt-2 overflow-x-auto rounded border border-emerald-700/30 bg-white shadow-sm">
      <table className="w-max min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-8 border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold text-slate-500" />
            {columns.map((column, index) => (
              <th
                key={`col-${column.key}`}
                className="border border-slate-300 bg-slate-100 px-2 py-1 text-center font-semibold text-slate-500"
              >
                {String.fromCharCode(65 + index)}
              </th>
            ))}
          </tr>
          <tr>
            <th className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold text-slate-500">
              1
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                className="whitespace-nowrap border border-slate-300 bg-[#e2efda] px-2.5 py-1.5 text-left font-semibold text-slate-800"
              >
                {column.label}
                {column.required ? <span className="ml-0.5 text-red-500">*</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`sample-row-${rowIndex}`}>
              <th className="border border-slate-300 bg-slate-100 px-1.5 py-1 text-center font-semibold text-slate-500">
                {rowIndex + 2}
              </th>
              {row.map((value, cellIndex) => (
                <td
                  key={`${columns[cellIndex]?.key ?? cellIndex}-sample-${rowIndex}`}
                  className="whitespace-nowrap border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700"
                >
                  {value || emptyCell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
