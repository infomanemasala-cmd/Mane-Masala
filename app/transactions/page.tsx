'use client'

import { useSearchParams } from 'next/navigation'
import TransactionDetail from '@/components/transaction-detail'

export default function TransactionPage(){
  const params=useSearchParams()
  const table=params.get('table')||''
  const id=params.get('id')||''
  if(!table||!id) return <section className="page-panel"><h1>Transaction</h1><p className="page-intro">Select a transaction from a list to open its complete details.</p></section>
  return <TransactionDetail table={table} id={id}/>
}
