'use client'

export function OrderStatusPanel() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-16 text-center">
      <p className="text-base font-semibold text-slate-700">주문서 현황 (진행률)</p>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-500">
        SMT·후공정·납품 실적 연동 후 진행률 대시보드가 표시됩니다.
        <br />
        생산 기록 모듈 이전이 완료되면 GAS와 동일한 현황 탭을 제공할 예정입니다.
      </p>
    </div>
  )
}
