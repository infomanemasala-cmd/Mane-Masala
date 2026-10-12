import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function pdfEscape(s: string) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildPdf(lines: string[]): Uint8Array {
  const contentLines: string[] = ['BT', '/F1 10 Tf', '50 780 Td', '14 TL']
  for (let i = 0; i < lines.length; i++) {
    if (i === 0) contentLines.push(`(${pdfEscape(lines[i])}) Tj`)
    else contentLines.push(`T* (${pdfEscape(lines[i])}) Tj`)
  }
  contentLines.push('ET')
  const stream = contentLines.join('\n')
  const objs: string[] = []
  objs.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj')
  objs.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj')
  objs.push('3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj')
  objs.push(`4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream endobj`)
  objs.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj')
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const o of objs) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += o + '\n'
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objs.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return new Uint8Array(Buffer.from(pdf, 'utf8'))
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const sb = await createClient()

  const { data: inv, error: invErr } = await sb
    .from('invoices')
    .select('id, invoice_number, business_code, invoice_date, total_amount, tax_amount, subtotal_amount, status, customer_id, notes')
    .eq('id', id)
    .maybeSingle()
  if (invErr || !inv) {
    return NextResponse.json({ error: invErr?.message || 'Invoice not found' }, { status: 404 })
  }

  const { data: customer } = inv.customer_id
    ? await sb.from('customers').select('name, business_code, customer_type, phone').eq('id', inv.customer_id).maybeSingle()
    : { data: null }

  const { data: lines } = await sb
    .from('invoice_lines')
    .select('line_number, item_id, description, quantity, unit_price, line_total, tax_rate, pack_qty, pack_size_kg, pack_label, rate_basis')
    .eq('invoice_id', id)
    .order('line_number', { ascending: true })

  const itemIds = Array.from(new Set((lines || []).map((l: any) => l.item_id).filter(Boolean)))
  const { data: items } = itemIds.length
    ? await sb.from('items').select('id, name, item_code, business_code').in('id', itemIds)
    : { data: [] }
  const itemMap = new Map((items || []).map((i: any) => [i.id, i]))

  const out: string[] = []
  out.push('MANE MASALA — TAX INVOICE')
  out.push(`Invoice: ${inv.invoice_number || inv.business_code || id}`)
  out.push(`Date: ${inv.invoice_date || ''}`)
  out.push(`Customer: ${customer?.name || ''} (${customer?.business_code || ''})`)
  if (customer?.phone) out.push(`Phone: ${customer.phone}`)
  out.push('')
  out.push('Lines:')
  for (const l of lines || []) {
    const it: any = itemMap.get(l.item_id) || {}
    const name = it.name || l.description || 'Item'
    const code = it.item_code || it.business_code || ''
    let qtyDisp = `${Number(l.quantity || 0)} kg`
    if (l.pack_qty != null && Number(l.pack_qty) > 0) {
      const label = l.pack_label || (l.pack_size_kg ? `${l.pack_size_kg} kg pack` : 'pack')
      qtyDisp = `${Number(l.pack_qty)} x ${label} (${Number(l.quantity || 0)} kg)`
    }
    const rate = Number(l.unit_price || 0)
    const total = Number(l.line_total || 0)
    out.push(`${code} ${name}`)
    out.push(`  Qty ${qtyDisp}  Rate ${rate.toFixed(2)}/kg  Line ${total.toFixed(2)}`)
  }
  out.push('')
  out.push(`Subtotal: ${Number((inv as any).subtotal_amount || 0).toFixed(2)}`)
  out.push(`Tax: ${Number((inv as any).tax_amount || 0).toFixed(2)}`)
  out.push(`Total: ${Number(inv.total_amount || 0).toFixed(2)}`)
  out.push(`Status: ${inv.status || ''}`)

  const bytes = buildPdf(out)
  const download = req.nextUrl.searchParams.get('download') === '1'
  const filename = `${inv.invoice_number || inv.business_code || 'invoice'}.pdf`
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
