'use client'

import type { ReactNode } from 'react'
import {
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type ErpTableShellProps = {
  children: ReactNode
  className?: string
  /** table에 붙일 min-width 등 */
  tableClassName?: string
}

export function ErpTableShell({ children, className = '', tableClassName = '' }: ErpTableShellProps) {
  return (
    <div className={[ERP_TABLE_WRAP_CLASS, className].filter(Boolean).join(' ')}>
      <div className="overflow-x-auto">
        <table className={[ERP_TABLE_CLASS, tableClassName].filter(Boolean).join(' ')}>{children}</table>
      </div>
    </div>
  )
}

export function ErpTableHead({ children }: { children: ReactNode }) {
  return <thead className={ERP_TABLE_HEAD_CLASS}>{children}</thead>
}

export function ErpTableTh({
  children,
  className = '',
  align = 'left',
}: {
  children: ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th className={[ERP_TABLE_TH_CLASS, alignClass, className].filter(Boolean).join(' ')}>
      {children}
    </th>
  )
}

export function ErpTableTd({
  children,
  className = '',
  align = 'left',
}: {
  children: ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''
  return (
    <td className={[ERP_TABLE_TD_CLASS, alignClass, className].filter(Boolean).join(' ')}>
      {children}
    </td>
  )
}
