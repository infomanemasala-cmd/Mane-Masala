'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'

type Row = Record<string, any>
const sb = () => createClient()
const today = () => new Date().toISOString().slice(0, 10)
const txt = (v: any) => String(v ?? '')

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) { return <select value={value} onChange={e => onChange(e.target.value)}>{children}</select> }
function Status({ message, error = false }: { message: string; error?: boolean }) { return message ? <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p> : null }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop"><div className="modal-card purchase-modal"><div className="modal-header"><h3>{title}</h3><button className="secondary-button" type="button" onClick={close}>Close</button></div>{children}</div></div> }

export default function PaymentConsoleFixed() {
  const [customers, setCustomers] = useState<Row[]>([])
  const [suppliers, setSuppliers] = useState<Row[]>([])
  const [invoices, setInvoices] = useState<Row[]>([])
  const [purchases, setPurchases] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<'customer' | 'supplier'>('customer')
  const [party, setParty] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('upi')
  const [ref, setRef] = useState('')
  const [notes, setNotes] = useState('')
  const [allocations, setAllocations] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = async () => {
    const [c, s, i, p] = await Promise.all([
      sb().from('customers').select('*').eq('is_active', true).order('name'),
      sb().from('suppliers').select('*').eq('is_active', true).order('business_name'),
      sb().from('invoices').select('*').order('invoice_date', { ascending: false }).limit(500),
      sb().from('purchases').select('*').order('purchase_date', { ascending: false }).limit(500),
    ])
    setCustomers(c.data ?? []); setSuppliers(s.data ?? []); setInvoices(i.data ?? []); setPurchases(p.data ?? [])
  }
  useEffect(() => { void load() }, [])

  const resetForm = () => { setParty(''); setAmount(''); setRef(''); setNotes(''); setAllocations([]); setMessage(''); setError(false) }
  const addAllocation = () => setAllocations(x => [...x, { id: '', amount: '' }])
  const patchAllocation = (index: number, key: string, value: string) => setAllocations(x => x.map((a, n) => n === index ? { ...a, [key]: value } : a))

  const submit = async () => {
    if (!party || Number(amount) <= 0) { setError(true); setMessage('Select the party and enter a positive payment amount.'); return }
    const clean = allocations.filter(a => a.id && Number(a.amount) > 0).map(a => direction === 'customer' ? { invoice_id: a.id, amount: Number(a.amount) } : { purchase_id: a.id, amount: Number(a.amount) })
    const allocated = clean.reduce((sum, a) => sum + Number(a.amount), 0)
    if (allocated > Number(amount)) { setError(true); setMessage('Allocated amount cannot exceed the payment amount.'); return }
    const rpc = direction === 'customer' ? 'record_customer_payment_allocated' : 'record_supplier_payment_allocated'
    const args = direction === 'customer'
      ? { p_customer_id: party, p_amount: Number(amount), p_payment_date: today(), p_method: method, p_allocations: clean, p_upi_reference: ref || null, p_notes: notes || null }
      : { p_supplier_id: party, p_amount: Number(amount), p_payment_date: today(), p_method: method, p_allocations: clean, p_upi_reference: ref || null, p_notes: notes || null }
    const { error: e } = await sb().rpc(rpc, args)
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage(Number(amount) - allocated > 0 ? `Payment recorded. ₹ ${(Number(amount) - allocated).toFixed(2)} kept as an advance.` : 'Payment recorded and allocated.')
    setRefreshToken(v => v + 1); await load(); setAmount(''); setRef(''); setNotes(''); setAllocations([])
  }

  const partyInvoices = invoices.filter(i => direction === 'customer' && (!party || txt(i.billing_customer_id) === party) && Number(i.amount_due) > 0)
  const partyPurchases = purchases.filter(p => direction === 'supplier' && (!party || txt(p.supplier_id) === party))

  return <section className="page-panel">
    <div className="section-label">Mane Masala</div>
    <div className="master-header"><div><h1>Payments</h1><p className="page-intro">Record customer receipts or supplier payments. One payment may cover multiple documents; any unallocated balance is recorded as an advance.</p></div><button className="primary-button" type="button" onClick={() => { resetForm(); setOpen(true) }}>+ Record Payment</button></div>
    {open && <Modal title={direction === 'customer' ? 'Receive Customer Payment' : 'Pay Supplier'} close={() => setOpen(false)}>
      <div className="master-tabs"><button className={direction === 'customer' ? 'tab-active' : ''} type="button" onClick={() => { setDirection('customer'); setParty(''); setAllocations([]) }}>Customer Receipt</button><button className={direction === 'supplier' ? 'tab-active' : ''} type="button" onClick={() => { setDirection('supplier'); setParty(''); setAllocations([]) }}>Supplier Payment</button></div>
      <Field label={direction === 'customer' ? 'Customer' : 'Supplier'}><Select value={party} onChange={setParty}><option value="">Select {direction}</option>{(direction === 'customer' ? customers : suppliers).map(x => <option key={txt(x.id)} value={txt(x.id)}>{txt(x.name || x.business_name)} — {txt(x.business_code)}</option>)}</Select></Field>
      <div className="form-grid"><Field label="Amount"><input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}/></Field><Field label="Method"><Select value={method} onChange={setMethod}><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></Select></Field><Field label="Payment reference"><input value={ref} onChange={e => setRef(e.target.value)}/></Field><Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)}/></Field></div>
      <h3>{direction === 'customer' ? 'Allocate to invoices' : 'Allocate to purchases'}</h3>
      {allocations.map((a, i) => <div className="purchase-line" key={i}><Field label={direction === 'customer' ? 'Invoice' : 'Purchase'}><Select value={a.id} onChange={v => patchAllocation(i, 'id', v)}><option value="">Select document</option>{(direction === 'customer' ? partyInvoices : partyPurchases).map(x => <option key={txt(x.id)} value={txt(x.id)}>{txt(x.business_code)}{direction === 'customer' ? ` — ₹ ${Number(x.amount_due).toFixed(2)} due` : ` — ${txt(x.supplier_invoice_number || 'supplier bill')}`}</option>)}</Select></Field><Field label="Allocation"><input type="number" min="0" step="0.01" value={a.amount} onChange={e => patchAllocation(i, 'amount', e.target.value)}/></Field></div>)}
      <button className="add-row-button" type="button" onClick={addAllocation}>＋ Add allocation</button><Status message={message} error={error}/><button className="primary-button" type="button" onClick={submit}>Record payment</button>
    </Modal>}
    <div className="console-grid"><div className="console-panel"><div className="panel-heading"><h2>Customer receipts</h2></div><DataTable table="customer_payments" refreshToken={refreshToken}/></div><div className="console-panel"><div className="panel-heading"><h2>Supplier payments</h2></div><DataTable table="supplier_payments" refreshToken={refreshToken}/></div></div>
  </section>
}
