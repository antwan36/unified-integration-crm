import { getDb } from './index'
import { newId } from './ids'
import { decryptPayeeTaxId } from './payees'
import type {
  CreatePayrollPaymentInput,
  Payroll1099Summary,
  PayrollPayment
} from '../../shared/types'

interface PayrollPaymentRow {
  id: string
  payeeId: string
  amountCents: number
  date: string
  method: PayrollPayment['method']
  contactId: string | null
  memo: string | null
  createdAt: Date
}

function toPayrollPayment(row: PayrollPaymentRow): PayrollPayment {
  return {
    id: row.id,
    payeeId: row.payeeId,
    amountCents: row.amountCents,
    date: row.date,
    method: row.method,
    contactId: row.contactId,
    memo: row.memo,
    createdAt: row.createdAt.toISOString()
  }
}

export async function listPayrollPayments(): Promise<PayrollPayment[]> {
  const result = await getDb().query<PayrollPaymentRow>(
    'SELECT * FROM payroll_payments ORDER BY date DESC, "createdAt" DESC'
  )
  return result.rows.map(toPayrollPayment)
}

export async function createPayrollPayment(
  input: CreatePayrollPaymentInput
): Promise<PayrollPayment> {
  const id = newId()
  await getDb().query(
    `INSERT INTO payroll_payments (id, "payeeId", "amountCents", date, method, "contactId", memo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      input.payeeId,
      input.amountCents,
      input.date,
      input.method,
      input.contactId ?? null,
      input.memo ?? null
    ]
  )
  const result = await getDb().query<PayrollPaymentRow>(
    'SELECT * FROM payroll_payments WHERE id = $1',
    [id]
  )
  return toPayrollPayment(result.rows[0])
}

export async function deletePayrollPayment(id: string): Promise<void> {
  await getDb().query('DELETE FROM payroll_payments WHERE id = $1', [id])
}

export async function get1099Summary(year: number): Promise<Payroll1099Summary> {
  const result = await getDb().query<{ payeeId: string; payeeName: string; totalCents: string }>(
    `SELECT p."payeeId" AS "payeeId", pe.name AS "payeeName", SUM(p."amountCents") AS "totalCents"
     FROM payroll_payments p
     JOIN payees pe ON pe.id = p."payeeId"
     WHERE pe.type = 'contractor' AND date_part('year', p.date::date) = $1
     GROUP BY p."payeeId", pe.name
     ORDER BY pe.name ASC`,
    [year]
  )
  const lines = await Promise.all(
    result.rows.map(async (row) => ({
      payeeId: row.payeeId,
      payeeName: row.payeeName,
      totalCents: Number(row.totalCents),
      taxId: await decryptPayeeTaxId(row.payeeId)
    }))
  )
  return { year, lines }
}
