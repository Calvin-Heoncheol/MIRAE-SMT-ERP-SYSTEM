'use client'

import { useEffect, useState } from 'react'
import { MaterialCombobox } from '@/components/materials/purchase-orders/material-combobox'
import { addAlternateMpn } from '@/lib/materials/repository'
import type { Material } from '@/lib/materials/types'

type MaterialBarcodeRegisterPanelProps = {
  materials: Material[]
  /** 검색창에 입력된 바코드(검색 실패 시 자동으로 채움) */
  suggestedBarcode?: string
  onRegistered?: () => void
}

export function MaterialBarcodeRegisterPanel({
  materials,
  suggestedBarcode = '',
  onRegistered,
}: MaterialBarcodeRegisterPanelProps) {
  const [barcode, setBarcode] = useState('')
  const [materialQuery, setMaterialQuery] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (suggestedBarcode.trim()) {
      setBarcode(suggestedBarcode.trim())
      setMessage(null)
    }
  }, [suggestedBarcode])

  async function handleRegister() {
    const value = barcode.trim()
    if (!value) {
      setMessage({ tone: 'error', text: '릴 바코드를 스캔하거나 입력해 주세요.' })
      return
    }
    if (!selectedMaterial) {
      setMessage({ tone: 'error', text: '대체 MPN을 등록할 자재를 선택해 주세요.' })
      return
    }

    const normalized = value.toLowerCase()
    const isDuplicate =
      selectedMaterial.mpn.trim().toLowerCase() === normalized ||
      selectedMaterial.alternateMpns.some((mpn) => mpn.trim().toLowerCase() === normalized)
    if (isDuplicate) {
      setMessage({ tone: 'error', text: '선택한 자재에 이미 등록된 MPN입니다.' })
      return
    }

    setBusy(true)
    setMessage(null)

    const result = await addAlternateMpn(
      selectedMaterial.id,
      value,
      selectedMaterial.alternateMpnRows.length + 1,
    )
    setBusy(false)

    if (!result.ok) {
      setMessage({ tone: 'error', text: result.detail })
      return
    }

    setMessage({
      tone: 'success',
      text: `${selectedMaterial.id} · ${selectedMaterial.materialName}에 "${result.row.mpn}" 대체 MPN을 등록했습니다.`,
    })
    setBarcode('')
    setMaterialQuery('')
    setSelectedMaterial(null)
    onRegistered?.()
  }

  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100'

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-violet-900">릴 바코드 → 대체 MPN 등록</h2>
          <p className="mt-0.5 text-xs text-violet-700/80">
            매칭이 안 되는 릴 바코드를 스캔한 뒤, 해당 자재를 선택해 등록하세요. 이후 입고·검색에서 자동 매칭됩니다.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">릴 바코드</span>
          <input
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleRegister()
              }
            }}
            disabled={busy}
            placeholder="1PCC0402… 또는 UT2327G-SC59.3R-TG"
            className={`${inputClassName} font-mono`}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">자재 선택</span>
          <MaterialCombobox
            value={materialQuery}
            materials={materials}
            placeholder="자재코드, MPN, 자재명 검색…"
            ariaLabel="대체 MPN 등록 자재"
            inputClassName={inputClassName}
            onValueChange={setMaterialQuery}
            onMaterialSelect={(material) => {
              setSelectedMaterial(material)
              setMaterialQuery(material.id)
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => void handleRegister()}
          disabled={busy}
          className="h-[38px] shrink-0 rounded-lg bg-slate-800 px-5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 lg:self-end"
        >
          {busy ? '등록 중…' : '등록'}
        </button>
      </div>

      {selectedMaterial ? (
        <p className="mt-2 text-xs text-slate-600">
          선택: <span className="font-medium">{selectedMaterial.id}</span> · {selectedMaterial.materialName}
          {selectedMaterial.mpn ? (
            <span className="font-mono text-slate-500"> (MPN: {selectedMaterial.mpn})</span>
          ) : null}
        </p>
      ) : null}

      {message ? (
        <p
          className={`mt-2 text-xs font-medium ${
            message.tone === 'success' ? 'text-emerald-700' : 'text-rose-600'
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  )

}
