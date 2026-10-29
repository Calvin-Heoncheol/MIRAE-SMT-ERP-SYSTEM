'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchDeliveryHistoryResult } from '@/lib/delivery/repository'
import type { DeliveryHistoryRow } from '@/lib/delivery/types'
import { displayOrderPoNumber, todayYmdSeoul } from '@/lib/orders/utils'
import { printHtmlDocument } from '@/lib/print/print-html'
import {
  buildInspectionCertificateFileTitle,
  buildInspectionCertificateHtml,
  buildInspectionDocNo,
  DEFAULT_INSPECTION_NOTES,
  defaultInspectionItems,
  isInspectionCertificatePassed,
  type InspectionCertificate,
  type InspectionJudgement,
} from '@/lib/quality/inspection-certificate'
import { ERP_TABLE_ROW_CLASS, formatEmptyListMessage } from '@/lib/ui/tokens'

type InspectionCertificateWorkspaceProps = {
  result: FetchDeliveryHistoryResult
}

const INPUT_CLASS =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100'

function emptyCertificate(): InspectionCertificate {
  const today = todayYmdSeoul()
  return {
    customer: '',
    issueDate: today,
    manager: '',
    docNo: buildInspectionDocNo('', today),
    productName: '',
    partNumber: '',
    shipmentQty: 0,
    inspectionQty: 0,
    items: defaultInspectionItems(),
    notes: DEFAULT_INSPECTION_NOTES,
    inspector: '',
    qaManager: '',
  }
}

function certificateFromShipment(row: DeliveryHistoryRow, previous: InspectionCertificate): InspectionCertificate {
  const issueDate = row.recordDate || todayYmdSeoul()
  return {
    ...previous,
    customer: row.customer,
    issueDate,
    docNo: buildInspectionDocNo(row.shipmentId, issueDate),
    productName: row.productName,
    partNumber: row.productCode,
    shipmentQty: row.quantity,
    inspectionQty: row.quantity,
    items: defaultInspectionItems(),
  }
}

function matchesSearch(row: DeliveryHistoryRow, query: string) {
  if (!query) return true
  return [row.shipmentId, row.customer, row.productName, row.productCode, row.customerPoNumber, row.orderNumber]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  )
}

export function InspectionCertificateWorkspace({ result }: InspectionCertificateWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [certificate, setCertificate] = useState<InspectionCertificate>(emptyCertificate)
  const [printError, setPrintError] = useState<string | null>(null)

  const shipments = useMemo(
    () => (result.ok ? result.rows.filter((row) => row.assemblyGroupId && row.quantity > 0) : []),
    [result],
  )
  const query = search.trim().toLowerCase()
  const filteredShipments = useMemo(
    () => shipments.filter((row) => matchesSearch(row, query)),
    [shipments, query],
  )

  if (!result.ok) {
    return <FetchErrorBanner reason={result.reason} title="출하 내역을 불러오지 못했습니다" detail={result.detail} />
  }

  function update<K extends keyof InspectionCertificate>(key: K, value: InspectionCertificate[K]) {
    setCertificate((current) => ({ ...current, [key]: value }))
  }

  function updateItem(index: number, patch: { judgement?: InspectionJudgement; remark?: string }) {
    setCertificate((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }))
  }

  function selectShipment(row: DeliveryHistoryRow) {
    setSelectedId(row.id)
    setCertificate((current) => certificateFromShipment(row, current))
  }

  function resetForm() {
    setSelectedId(null)
    setCertificate((current) => ({ ...emptyCertificate(), manager: current.manager, inspector: current.inspector, qaManager: current.qaManager }))
  }

  function handlePrint() {
    setPrintError(null)
    const ok = printHtmlDocument(
      buildInspectionCertificateHtml(certificate),
      buildInspectionCertificateFileTitle(certificate),
    )
    if (!ok) setPrintError('인쇄 창을 열 수 없습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.')
  }

  const passed = isInspectionCertificatePassed(certificate)

  return (
    <PageShell className="gap-4">
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="flex min-h-0 flex-col gap-3">
          <WorkspaceHeader
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="출하번호, 고객사, 제품명, 발주번호 검색…"
            accent="sky"
            meta="출하 내역을 선택하면 고객사·품명·품번·수량이 성적서에 채워집니다."
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {filteredShipments.length === 0 ? (
              <EmptyListState
                message={formatEmptyListMessage({
                  hasQuery: Boolean(query),
                  emptyLabel: '출하 내역이 없습니다',
                  actionHint: '출하 및 거래명세서에서 출하를 등록하면 여기에 표시됩니다',
                })}
              />
            ) : (
              <ErpTableShell tableClassName="min-w-[640px]">
                <ErpTableHead>
                  <tr>
                    <ErpTableTh>출하일</ErpTableTh>
                    <ErpTableTh>출하번호</ErpTableTh>
                    <ErpTableTh>고객사</ErpTableTh>
                    <ErpTableTh>제품</ErpTableTh>
                    <ErpTableTh align="right">수량</ErpTableTh>
                  </tr>
                </ErpTableHead>
                <tbody>
                  {filteredShipments.map((row) => {
                    const selected = row.id === selectedId
                    return (
                      <tr
                        key={row.id}
                        onClick={() => selectShipment(row)}
                        className={`${ERP_TABLE_ROW_CLASS} cursor-pointer ${selected ? 'bg-sky-50 ring-1 ring-inset ring-sky-300' : ''}`}
                      >
                        <ErpTableTd className="tabular-nums">{row.recordDate || '—'}</ErpTableTd>
                        <ErpTableTd title={displayOrderPoNumber(row.customerPoNumber, row.orderNumber)}>
                          {row.shipmentId || '—'}
                        </ErpTableTd>
                        <ErpTableTd text="wrap">{row.customer || '—'}</ErpTableTd>
                        <ErpTableTd text="wrap">
                          <p className="font-medium text-slate-900">{row.productName || '—'}</p>
                          {row.productCode ? <p className="text-xs text-slate-500">{row.productCode}</p> : null}
                        </ErpTableTd>
                        <ErpTableTd align="right" className="tabular-nums">
                          {row.quantity.toLocaleString('ko-KR')}
                        </ErpTableTd>
                      </tr>
                    )
                  })}
                </tbody>
              </ErpTableShell>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">출하검사성적서</h2>
              <p className="text-xs text-slate-500">
                종합 판정{' '}
                <span className={passed ? 'font-bold text-emerald-700' : 'font-bold text-red-600'}>
                  {passed ? '합격' : '불합격'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                새로 작성
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                인쇄 / PDF
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {printError ? <p className="text-sm text-red-600">{printError}</p> : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="고객사 (Client)">
                <input className={INPUT_CLASS} value={certificate.customer} onChange={(e) => update('customer', e.target.value)} />
              </Field>
              <Field label="작성일자 (Date)">
                <input
                  type="date"
                  className={INPUT_CLASS}
                  value={certificate.issueDate}
                  onChange={(e) => update('issueDate', e.target.value)}
                />
              </Field>
              <Field label="담당자 (Manager)">
                <input className={INPUT_CLASS} value={certificate.manager} onChange={(e) => update('manager', e.target.value)} />
              </Field>
              <Field label="문서번호 (Doc No.)">
                <input className={INPUT_CLASS} value={certificate.docNo} onChange={(e) => update('docNo', e.target.value)} />
              </Field>
              <Field label="품명 (Product Name)">
                <input
                  className={INPUT_CLASS}
                  value={certificate.productName}
                  onChange={(e) => update('productName', e.target.value)}
                />
              </Field>
              <Field label="품번 (Part Number)">
                <input
                  className={INPUT_CLASS}
                  value={certificate.partNumber}
                  onChange={(e) => update('partNumber', e.target.value)}
                />
              </Field>
              <Field label="출하 수량 (PCS)">
                <input
                  type="number"
                  min={0}
                  className={INPUT_CLASS}
                  value={certificate.shipmentQty || ''}
                  onChange={(e) => update('shipmentQty', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                />
              </Field>
              <Field label="검사 수량 (PCS)">
                <input
                  type="number"
                  min={0}
                  className={INPUT_CLASS}
                  value={certificate.inspectionQty || ''}
                  onChange={(e) => update('inspectionQty', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                />
              </Field>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-800">SMT 및 조립 검사 항목</p>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th className="px-2 py-2 text-left">No.</th>
                      <th className="px-2 py-2 text-left">검사 항목 / 판정 기준</th>
                      <th className="px-2 py-2 text-center">판정</th>
                      <th className="px-2 py-2 text-left">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificate.items.map((item, index) => (
                      <tr key={item.title} className="border-t border-slate-200 align-top">
                        <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                        <td className="px-2 py-2">
                          <p className="font-semibold text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-500">
                            {item.specification} ({item.method})
                          </p>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex justify-center gap-1">
                            {(['pass', 'fail'] as const).map((value) => {
                              const active = item.judgement === value
                              const tone =
                                value === 'pass'
                                  ? active
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 text-slate-400'
                                  : active
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-slate-200 text-slate-400'
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => updateItem(index, { judgement: value })}
                                  className={`whitespace-nowrap rounded border px-2 py-1 text-xs font-semibold ${tone}`}
                                >
                                  {value === 'pass' ? '합격' : '불합격'}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            className={INPUT_CLASS}
                            value={item.remark}
                            onChange={(e) => updateItem(index, { remark: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Field label="특기사항 (Notes)">
              <textarea
                rows={3}
                className={INPUT_CLASS}
                value={certificate.notes}
                onChange={(e) => update('notes', e.target.value)}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="품질 검사자 (Inspector)">
                <input className={INPUT_CLASS} value={certificate.inspector} onChange={(e) => update('inspector', e.target.value)} />
              </Field>
              <Field label="품질 책임자 (QA Manager)">
                <input className={INPUT_CLASS} value={certificate.qaManager} onChange={(e) => update('qaManager', e.target.value)} />
              </Field>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  )
}
