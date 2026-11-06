export interface TuitionCharge {
  id: string;
  student_id: string;
  title: string;
  contract_number: string;
  amount_kopecks: number;
  due_on: string;
  paid_at: string | null;
  payment_reference: string | null;
  demo_only: boolean;
}

export function money(kopecks: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency", currency: "RUB", maximumFractionDigits: kopecks % 100 ? 2 : 0,
  }).format(kopecks / 100);
}

export function tuitionSummary(charges: TuitionCharge[], today: string) {
  const schedule = [...charges].sort((a, b) => b.due_on.localeCompare(a.due_on));
  const unpaid = charges.filter(charge => !charge.paid_at).sort((a, b) => a.due_on.localeCompare(b.due_on));
  const paid = charges.filter(charge => charge.paid_at).sort((a, b) =>
    Date.parse(b.paid_at!) - Date.parse(a.paid_at!) || b.due_on.localeCompare(a.due_on));
  return {
    schedule, unpaid, paid, next: unpaid[0] ?? null,
    balance: unpaid.reduce((sum, charge) => sum + charge.amount_kopecks, 0),
    paidTotal: paid.reduce((sum, charge) => sum + charge.amount_kopecks, 0),
    overdue: unpaid.filter(charge => charge.due_on < today).length,
  };
}
