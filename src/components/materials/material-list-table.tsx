'use client'

import { MATERIAL_COLUMN_LABELS } from '@/lib/materials/types'
import { formatMaterialMoney } from '@/lib/materials/utils'
import type { Material } from '@/lib/materials/types'

type MaterialListTableProps = {
  materials: Material[]
  emptyMessage: string
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

const codeCellClass =
  'whitespace-nowrap text-sm tabular-nums [word-break:keep-all] [overflow-wrap:normal]'

function TruncatedText({
  value,
  className = '',
  maxWidthClass = 'max-w-48',
}: {
  value: string
  className?: string
  maxWidthClass?: string
}) {
  const text = cell(value)
  if (text === '-') {
    return <span className={`text-sm text-slate-400 ${className}`}>-</span>
  }

  return (
    <span
      className={`block truncate text-sm ${maxWidthClass} ${className}`}
      title={text}
    >
      {text}
    </span>
  )
}

export function MaterialListTable({ materials, emptyMessage }: MaterialListTableProps) {
  if (!materials.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">자재 마스터(등록 시트) 데이터가 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] table-fixed border-collapse">
          <thead className="bg-violet-50/80">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.customer}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.materialName}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.specification}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.process}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.cpn}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.mpn}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.mpn2}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.spn}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.spn2}
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.supplier}
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.supplyType}
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.moq}
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold tracking-wide text-violet-900 uppercase">
                {MATERIAL_COLUMN_LABELS.unitPrice}
              </th>
            </tr>
          </thead>
          <tbody>
            {materials.map((material) => (
              <tr key={material.id} className="border-t border-slate-100 hover:bg-violet-50/40">
                <td className="px-3 py-2.5">
                  <TruncatedText value={material.customer} maxWidthClass="max-w-28" />
                </td>
                <td className="px-3 py-2.5">
                  <TruncatedText value={material.materialName} className="font-medium text-slate-900" maxWidthClass="max-w-36" />
                </td>
                <td className="px-3 py-2.5">
                  <TruncatedText value={material.specification} maxWidthClass="max-w-52" />
                </td>
                <td className="px-3 py-2.5 text-center text-sm text-slate-700">{cell(material.process)}</td>
                <td className={`px-3 py-2.5 font-medium text-violet-800 ${codeCellClass}`}>
                  {cell(material.cpn)}
                </td>
                <td className={`px-3 py-2.5 text-slate-700 ${codeCellClass}`}>{cell(material.mpn)}</td>
                <td className={`px-3 py-2.5 text-slate-700 ${codeCellClass}`}>{cell(material.mpn2)}</td>
                <td className={`px-3 py-2.5 text-slate-700 ${codeCellClass}`}>{cell(material.spn)}</td>
                <td className={`px-3 py-2.5 text-slate-700 ${codeCellClass}`}>{cell(material.spn2)}</td>
                <td className="px-3 py-2.5">
                  <TruncatedText value={material.supplier} maxWidthClass="max-w-32" />
                </td>
                <td className="px-3 py-2.5 text-center text-sm text-slate-700">{cell(material.supplyType)}</td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                  {material.moq > 0 ? material.moq.toLocaleString('ko-KR') : '-'}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {material.unitPrice > 0 ? formatMaterialMoney(material.unitPrice) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
