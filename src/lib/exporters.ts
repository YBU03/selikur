'use client'
import type { Category, Product, ShoppingItem, ShoppingList, Supplier, Variant } from './types'
import { indexVariants, variantLabel } from './queries'
import { photoUrl } from './supabase'
import { rupiah, tgl, unitLabel, pct, num } from './format'
import type { Recap } from './recap'
import { breakdown, type PricingCfg } from './pricing'

export type Deliver = 'download' | 'share'

export async function deliver(blob: Blob, filename: string, mode: Deliver = 'download', title?: string) {
  const file = new File([blob], filename, { type: blob.type })
  if (mode === 'share' && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title ?? filename })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const GREEN = '0B5F49'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

async function workbook() {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Selikur'
  wb.created = new Date()
  return wb
}

type Sheet = import('exceljs').Worksheet

function styleSheet(ws: Sheet, moneyCols: string[] = []) {
  const header = ws.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GREEN}` } }
  header.alignment = { vertical: 'middle' }
  header.height = 22
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  for (const k of moneyCols) ws.getColumn(k).numFmt = '"Rp" #,##0'
}

async function wbBlob(wb: import('exceljs').Workbook) {
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: XLSX_MIME })
}

function stamp() {
  return tgl(new Date()).replace(/\//g, '-')
}

function safe(name: string) {
  return name.replace(/[^\w-]+/g, '-').replace(/-+/g, '-')
}

export async function exportCatalogExcel(
  products: Product[],
  categories: Category[],
  suppliers: Supplier[],
  cfgFor: (p: Product) => PricingCfg,
  mode: Deliver = 'download',
) {
  const wb = await workbook()
  const cat = new Map(categories.map((c) => [c.id, c.name]))
  const sup = new Map(suppliers.map((s) => [s.id, s.name]))
  const ws = wb.addWorksheet('Katalog')
  ws.columns = [
    { header: 'Produk', key: 'product', width: 32 },
    { header: 'Varian', key: 'variant', width: 20 },
    { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Kategori', key: 'category', width: 14 },
    { header: 'Supplier', key: 'supplier', width: 18 },
    { header: 'Status', key: 'status', width: 11 },
    { header: 'Harga Kulak', key: 'buy', width: 14 },
    { header: 'Harga Jual', key: 'sell', width: 14 },
    { header: 'Potongan Platform', key: 'fee', width: 16 },
    { header: 'Komisi Affiliate', key: 'aff', width: 15 },
    { header: 'Laba Bersih', key: 'profit', width: 14 },
    { header: 'Margin (dari modal)', key: 'mcost', width: 12 },
    { header: 'Stok (pcs)', key: 'stock', width: 11 },
    { header: 'Stok Min', key: 'min', width: 10 },
    { header: 'Foto', key: 'photo', width: 40 },
  ]
  const label = { active: 'Aktif', candidate: 'Kandidat', inactive: 'Nonaktif' }
  for (const p of products) {
    const cfg = cfgFor(p)
    for (const v of p.variants.length ? p.variants : [null as unknown as Variant]) {
      const b = v ? breakdown(v.buy_price, v.sell_price, cfg) : null
      ws.addRow({
        product: p.name,
        variant: v?.name ?? '',
        sku: v?.sku ?? '',
        category: p.category_id ? cat.get(p.category_id) : '',
        supplier: p.supplier_id ? sup.get(p.supplier_id) : '',
        status: label[p.status],
        buy: v?.buy_price ?? null,
        sell: v?.sell_price ?? null,
        fee: b?.fee ?? null,
        aff: b?.affiliate ?? null,
        profit: b?.profit ?? null,
        mcost: b?.marginOnCost ?? null,
        stock: v?.stock ?? null,
        min: v?.min_stock ?? null,
        photo: p.photos[0] ? photoUrl(p.photos[0]) : '',
      })
    }
  }
  styleSheet(ws, ['buy', 'sell', 'fee', 'aff', 'profit'])
  ws.getColumn('mcost').numFmt = '0.0%'
  await deliver(await wbBlob(wb), `Selikur-Katalog-${stamp()}.xlsx`, mode)
}

export async function exportListExcel(list: ShoppingList, items: ShoppingItem[], products: Product[], suppliers: Supplier[], mode: Deliver = 'download') {
  const wb = await workbook()
  const idx = indexVariants(products)
  const sup = new Map(suppliers.map((s) => [s.id, s.name]))
  const ws = wb.addWorksheet('Daftar Belanja')
  ws.columns = [
    { header: 'Supplier', key: 'supplier', width: 20 },
    { header: 'Barang', key: 'name', width: 34 },
    { header: 'SKU', key: 'sku', width: 14 },
    { header: 'Qty Rencana', key: 'qp', width: 12 },
    { header: 'Harga Rencana', key: 'pp', width: 14 },
    { header: 'Subtotal Rencana', key: 'sp', width: 16 },
    { header: 'Qty Aktual', key: 'qa', width: 11 },
    { header: 'Harga Aktual', key: 'pa', width: 14 },
    { header: 'Subtotal Aktual', key: 'sa', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
  ]
  for (const it of items) {
    const e = it.variant_id ? idx.get(it.variant_id) : undefined
    const supId = it.supplier_id ?? e?.product.supplier_id
    ws.addRow({
      supplier: supId ? sup.get(supId) : '',
      name: e ? variantLabel(e.product, e.variant) : it.custom_name,
      sku: e?.variant.sku ?? '',
      qp: it.qty_planned,
      pp: it.price_planned,
      sp: it.qty_planned * it.price_planned,
      qa: it.qty_actual,
      pa: it.price_actual,
      sa: it.status === 'bought' ? (it.qty_actual ?? it.qty_planned) * (it.price_actual ?? it.price_planned) : null,
      status: it.status === 'bought' ? 'Terbeli' : it.status === 'unavailable' ? 'Tidak tersedia' : 'Belum',
    })
  }
  const total = ws.addRow({ name: 'TOTAL', sp: list.planned_total, sa: list.actual_total })
  total.font = { bold: true }
  styleSheet(ws, ['pp', 'sp', 'pa', 'sa'])
  await deliver(await wbBlob(wb), `Selikur-${safe(list.title)}-${stamp()}.xlsx`, mode)
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const b = await res.blob()
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => resolve(null)
      r.readAsDataURL(b)
    })
  } catch {
    return null
  }
}

type AutoTable = typeof import('jspdf-autotable').default

async function pdfBase(title: string, subtitle: string) {
  const { jsPDF } = await import('jspdf')
  const autoTable: AutoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFillColor(11, 95, 73)
  doc.rect(0, 0, 210, 26, 'F')
  const logo = await toDataUrl('/icons/icon-192.png')
  if (logo) doc.addImage(logo, 'PNG', 12, 5, 16, 16)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(title, 32, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(subtitle, 32, 18.5)
  doc.setTextColor(18, 26, 22)
  return { doc, autoTable }
}

function lastY(doc: unknown) {
  return (doc as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

export async function exportListPdf(
  list: ShoppingList,
  items: ShoppingItem[],
  products: Product[],
  suppliers: Supplier[],
  storeName: string,
  mode: Deliver = 'download',
) {
  const idx = indexVariants(products)
  const sup = new Map(suppliers.map((s) => [s.id, s]))
  const { doc, autoTable } = await pdfBase(list.title, `${storeName} · dicetak ${tgl(new Date())} · ${items.length} barang`)

  const groups = new Map<string, ShoppingItem[]>()
  for (const it of items) {
    const e = it.variant_id ? idx.get(it.variant_id) : undefined
    const key = it.supplier_id ?? e?.product.supplier_id ?? '-'
    groups.set(key, [...(groups.get(key) ?? []), it])
  }
  const images = new Map<string, string | null>()
  await Promise.all(
    items.map(async (it) => {
      const e = it.variant_id ? idx.get(it.variant_id) : undefined
      const p = e?.variant.photo ?? e?.product.photos[0]
      if (p) images.set(it.id, await toDataUrl(photoUrl(p)!))
    }),
  )

  let y = 32
  for (const [key, rows] of groups) {
    const s = sup.get(key)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(s ? `${s.name}${s.location ? ` - ${s.location}` : ''}`.slice(0, 95) : 'Tanpa supplier', 12, y + 4)
    const body = rows.map((it) => {
      const e = it.variant_id ? idx.get(it.variant_id) : undefined
      return [
        '',
        '',
        e ? variantLabel(e.product, e.variant) : it.custom_name ?? '',
        e ? unitLabel(it.qty_planned, e.variant.unit, e.variant.unit_size) : `${it.qty_planned} pcs`,
        rupiah(it.price_planned),
        rupiah(it.qty_planned * it.price_planned),
        '',
      ]
    })
    autoTable(doc, {
      startY: y + 7,
      head: [['', 'Foto', 'Barang', 'Qty', 'Harga', 'Subtotal', 'Harga aktual']],
      body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, valign: 'middle', lineColor: [221, 225, 220] },
      headStyles: { fillColor: [238, 248, 243], textColor: [11, 95, 73], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 16, minCellHeight: 15 },
        3: { cellWidth: 28 },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 26, halign: 'right' },
        6: { cellWidth: 26 },
      },
      margin: { left: 12, right: 12 },
      didDrawCell: (d) => {
        if (d.section !== 'body') return
        const it = rows[d.row.index]
        if (d.column.index === 0) {
          doc.setDrawColor(11, 95, 73)
          doc.setLineWidth(0.4)
          doc.rect(d.cell.x + 2, d.cell.y + d.cell.height / 2 - 2, 4, 4)
          if (it.status === 'bought') {
            doc.line(d.cell.x + 2.6, d.cell.y + d.cell.height / 2, d.cell.x + 3.6, d.cell.y + d.cell.height / 2 + 1.2)
            doc.line(d.cell.x + 3.6, d.cell.y + d.cell.height / 2 + 1.2, d.cell.x + 5.4, d.cell.y + d.cell.height / 2 - 1.4)
          }
        }
        if (d.column.index === 1) {
          const img = images.get(it.id)
          if (img) doc.addImage(img, 'JPEG', d.cell.x + 1.5, d.cell.y + 1.5, 13, 12)
        }
      },
    })
    y = lastY(doc) + 6
    if (y > 260) {
      doc.addPage()
      y = 16
    }
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Estimasi total: ${rupiah(list.planned_total)}`, 12, y + 4)
  if (list.budget) {
    doc.setFont('helvetica', 'normal')
    doc.text(`Anggaran: ${rupiah(list.budget)}`, 12, y + 10)
  }
  await deliver(doc.output('blob'), `Selikur-${safe(list.title)}.pdf`, mode, list.title)
}

export async function exportRecapPdf(title: string, periodLabel: string, r: Recap, prev: Recap | null, storeName: string, mode: Deliver = 'download') {
  const { doc, autoTable } = await pdfBase(`Rekap Belanja ${title}`, `${storeName} · ${periodLabel}`)
  const change = prev && prev.total > 0 ? (r.total - prev.total) / prev.total : null
  autoTable(doc, {
    startY: 32,
    body: [
      ['Total belanja', rupiah(r.total), change == null ? '' : `${change >= 0 ? 'Naik' : 'Turun'} ${pct(Math.abs(change))} vs periode lalu`],
      ['Rencana vs realisasi', `${rupiah(r.planned)} -> ${rupiah(r.total)}`, `Selisih ${rupiah(r.total - r.planned)}`],
      ['Item terbeli', `${num(r.itemsBought)} dari ${num(r.itemsPlanned)} (${pct(r.fulfillment)})`, `${num(r.pcs)} pcs · ${r.lists} kali belanja`],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48 }, 1: { cellWidth: 70 } },
    margin: { left: 12, right: 12 },
  })
  const section = (heading: string, rows: { name: string; amount: number; pcs: number }[]) => {
    const y = lastY(doc) + 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(heading, 12, y)
    autoTable(doc, {
      startY: y + 3,
      head: [['Nama', 'Pcs', 'Total', '%']],
      body: rows.map((g) => [g.name, num(g.pcs), rupiah(g.amount), pct(r.total ? g.amount / r.total : 0)]),
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [11, 95, 73] },
      columnStyles: { 1: { halign: 'right', cellWidth: 20 }, 2: { halign: 'right', cellWidth: 36 }, 3: { halign: 'right', cellWidth: 18 } },
      margin: { left: 12, right: 12 },
    })
  }
  section('Per kategori', r.byCategory)
  section('Per supplier', r.bySupplier)
  section('Per produk', r.byProduct)
  await deliver(doc.output('blob'), `Selikur-Rekap-${safe(title)}.pdf`, mode, `Rekap ${title}`)
}

export async function exportRecapExcel(title: string, r: Recap, mode: Deliver = 'download') {
  const wb = await workbook()
  const sum = wb.addWorksheet('Ringkasan')
  sum.columns = [
    { header: 'Ringkasan', key: 'k', width: 28 },
    { header: title, key: 'v', width: 22 },
  ]
  sum.addRows([
    { k: 'Total belanja', v: r.total },
    { k: 'Total rencana', v: r.planned },
    { k: 'Item direncanakan', v: r.itemsPlanned },
    { k: 'Item terbeli', v: r.itemsBought },
    { k: 'Item tidak tersedia', v: r.itemsUnavailable },
    { k: 'Total pcs', v: r.pcs },
    { k: 'Kesesuaian rencana', v: r.fulfillment },
  ])
  styleSheet(sum)
  sum.getCell('B2').numFmt = '"Rp" #,##0'
  sum.getCell('B3').numFmt = '"Rp" #,##0'
  sum.getCell('B8').numFmt = '0%'
  for (const [name, rows] of [
    ['Per Kategori', r.byCategory],
    ['Per Supplier', r.bySupplier],
    ['Per Produk', r.byProduct],
  ] as const) {
    const ws = wb.addWorksheet(name)
    ws.columns = [
      { header: 'Nama', key: 'name', width: 32 },
      { header: 'Pcs', key: 'pcs', width: 10 },
      { header: 'Total', key: 'amount', width: 16 },
    ]
    rows.forEach((g) => ws.addRow(g))
    styleSheet(ws, ['amount'])
  }
  const raw = wb.addWorksheet('Data Mentah')
  raw.columns = [
    { header: 'Tanggal', key: 'date', width: 12 },
    { header: 'Daftar', key: 'list', width: 22 },
    { header: 'Produk', key: 'product', width: 28 },
    { header: 'Varian', key: 'variant', width: 16 },
    { header: 'Kategori', key: 'category', width: 16 },
    { header: 'Supplier', key: 'supplier', width: 18 },
    { header: 'Qty Rencana', key: 'qtyPlanned', width: 12 },
    { header: 'Harga Rencana', key: 'pricePlanned', width: 14 },
    { header: 'Qty Aktual', key: 'qtyActual', width: 11 },
    { header: 'Harga Aktual', key: 'priceActual', width: 14 },
    { header: 'Subtotal', key: 'amount', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
  ]
  r.rows.forEach((x) => raw.addRow({ ...x, date: tgl(x.date) }))
  styleSheet(raw, ['pricePlanned', 'priceActual', 'amount'])
  await deliver(await wbBlob(wb), `Selikur-Rekap-${safe(title)}.xlsx`, mode)
}

export function listWhatsAppText(list: ShoppingList, items: ShoppingItem[], products: Product[], suppliers: Supplier[]) {
  const idx = indexVariants(products)
  const sup = new Map(suppliers.map((s) => [s.id, s.name]))
  const groups = new Map<string, string[]>()
  for (const it of items) {
    const e = it.variant_id ? idx.get(it.variant_id) : undefined
    const key = it.supplier_id ?? e?.product.supplier_id ?? ''
    const name = e ? variantLabel(e.product, e.variant) : it.custom_name
    const qty = e ? unitLabel(it.qty_planned, e.variant.unit, e.variant.unit_size) : `${it.qty_planned} pcs`
    const mark = it.status === 'bought' ? '✅' : it.status === 'unavailable' ? '❌' : '⬜'
    groups.set(key, [...(groups.get(key) ?? []), `${mark} ${name} — ${qty}`])
  }
  let text = `*${list.title}*\n`
  for (const [k, lines] of groups) text += `\n*${k ? sup.get(k) : 'Lainnya'}*\n${lines.join('\n')}\n`
  text += `\nEstimasi: ${rupiah(list.planned_total)}`
  return text
}
