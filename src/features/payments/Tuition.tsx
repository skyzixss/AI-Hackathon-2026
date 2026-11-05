import { useMoscowDay } from "../studies/useMoscowDay.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../app/Icon.tsx";
import { ResourceState, useResource } from "../../app/resource.tsx";
import { dateLabel, moscowDay } from "../studies/dates.ts";
import type { TuitionApi } from "./api.ts";
import { money, tuitionSummary, type TuitionCharge } from "./model.ts";
import "./tuition.css";

function dueDate(day: string) {
  return dateLabel(day, { day: "numeric", month: "long", year: "numeric" });
}

export function Tuition({ api, sessionKey }: { api: TuitionApi; sessionKey: string }) {
  const load = useCallback(async () => {
    const charges = await api.charges();
    if (charges.some(charge => charge.student_id !== sessionKey)) throw new Error("Invoice owner mismatch");
    return charges;
  }, [api, sessionKey]);
  const { state, retry } = useResource(sessionKey + ":tuition", load);
  const [selected, setSelected] = useState<TuitionCharge | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [receipt, setReceipt] = useState<TuitionCharge | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const success = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const submitting = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!selected) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [selected]);
  useEffect(() => { if (receipt) success.current?.focus(); }, [receipt]);

  function close() { setSelected(null); setError(false); }
  async function confirm() {
    if (!selected || submitting.current) return;
    submitting.current = true; setPending(true); setError(false);
    try {
      const paid = await api.payDemo(selected.id);
      if (!alive.current) return;
      if (paid.student_id !== sessionKey) throw new Error("Invoice owner mismatch");
      setSelected(null); setReceipt(paid); retry();
    } catch { if (alive.current) setError(true); }
    finally { submitting.current = false; if (alive.current) setPending(false); }
  }

  const today = useMoscowDay();
  const data = state.status === "ready" ? tuitionSummary(state.data, today) : null;
  return <div className="tuition-page">
    <p className="tuition-demo-note"><Icon name="school" />Демо-оплата · Настоящие деньги не списываются</p>
    {pending && <p role="status">Подтверждение ещё ожидается. Окно можно закрыть; это не отменяет запрос. Не повторяйте оплату до получения результата.</p>}
    {receipt && <div ref={success} tabIndex={-1} role="status" className="tuition-success">
      <Icon name="check" size={24} /><div><strong>Демо-платёж проведён</strong>
        <p>{money(receipt.amount_kopecks)} · {receipt.title}</p>
        <small>Подтверждение {receipt.payment_reference}. Сохранено в истории.</small></div>
    </div>}
    {state.status !== "ready" && <section className="panel"><ResourceState state={state} retry={retry} /></section>}
    {data && state.status === "ready" && (state.data.length === 0 ?
      <section className="panel empty-state"><Icon name="payment" size={36} /><h2>Счетов пока нет</h2>
        <p>Когда появятся начисления за обучение, здесь будут сумма, срок и история оплаты.</p></section> : <>
      <div className="tuition-overview">
        <section className="tuition-next" aria-labelledby="tuition-next-title">
          <span className="tuition-kicker">{data.next ? "Ближайший платёж" : "Всё оплачено"}</span>
          <h2 id="tuition-next-title" className="tuition-amount">{money(data.next?.amount_kopecks ?? 0)}</h2>
          {data.next ? <>
            <p className="tuition-purpose">{data.next.title}</p>
            <p className="tuition-due"><Icon name="calendar" />{data.next.due_on < today ? "Срок прошёл: " : "Оплатить до "}{dueDate(data.next.due_on)}</p>
            <button className="button hero-button" onClick={() => { setSelected(data.next); setError(false); }} disabled={!data.next.demo_only}>
              Оплатить в демо<Icon name="arrow" /></button>
            {!data.next.demo_only && <p className="small">Онлайн-оплата этого счёта пока недоступна.</p>}
          </> : <><p className="tuition-purpose">По выставленным счетам задолженности нет.</p>
            <span className="tuition-paid-mark"><Icon name="check" />Можно сосредоточиться на учёбе</span></>}
        </section>
        <section className="panel tuition-balance" aria-labelledby="tuition-balance-title">
          <h2 id="tuition-balance-title">По выставленным счетам</h2>
          <dl><div><dt>Осталось оплатить</dt><dd>{money(data.balance)}</dd></div>
            <div><dt>Уже оплачено</dt><dd className="positive">{money(data.paidTotal)}</dd></div>
            <div><dt>Учебный договор</dt><dd className="tuition-contract">{state.data[0].contract_number}</dd></div></dl>
          {data.overdue > 0 && <p className="tuition-overdue"><Icon name="clock" />Есть платежи с истёкшим сроком: {data.overdue}</p>}
          <p className="small muted">Все суммы и документы в этом разделе вымышлены.</p>
        </section>
      </div>
      <section className="panel" aria-labelledby="tuition-plan-title">
        <div className="section-heading"><h2 id="tuition-plan-title">График оплаты</h2><span className="small muted">{data.unpaid.length ? `Платежей впереди: ${data.unpaid.length}` : "Все платежи внесены"}</span></div>
        <ul className="tuition-schedule">{[...state.data].sort((a, b) => a.due_on.localeCompare(b.due_on)).map(charge =>
          <li key={charge.id} className={charge.paid_at ? "tuition-charge is-paid" : "tuition-charge"}>
            <span className="tuition-charge-icon"><Icon name={charge.paid_at ? "check" : "calendar"} /></span>
            <div className="tuition-charge-copy"><h3>{charge.title}</h3><p>{dueDate(charge.due_on)}</p></div>
            <strong className="tuition-charge-amount">{money(charge.amount_kopecks)}</strong>
            {charge.paid_at ? <span className="pill tuition-status-paid">Оплачено</span> : <button className="button secondary"
              disabled={!charge.demo_only} aria-label={`Демо-оплата: ${charge.title}`} onClick={() => { setSelected(charge); setError(false); }}>
                {charge.due_on < today ? "Просрочен · оплатить" : "Оплатить"}</button>}
          </li>)}</ul>
      </section>
      <section className="panel" aria-labelledby="tuition-history-title">
        <div className="section-heading"><h2 id="tuition-history-title">История платежей</h2><span className="small muted">Только подтверждённые</span></div>
        {data.paid.length ? <ul className="tuition-history">{data.paid.map(charge => <li key={charge.id}>
          <span className="tuition-charge-icon"><Icon name="document" /></span>
          <div><h3>{charge.title}</h3><p>{dueDate(moscowDay(new Date(charge.paid_at!)))} · {charge.payment_reference}</p></div>
          <strong>{money(charge.amount_kopecks)}</strong></li>)}</ul> : <p className="muted">Платежей пока нет. После демо-оплаты здесь появится подтверждение.</p>}
      </section>
    </>)}
    <dialog ref={dialog} className="tuition-dialog" aria-labelledby="tuition-confirm-title"
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => { if (event.target === event.currentTarget) close(); }}>
      {selected && <div className="tuition-dialog-body">
        <div className="section-heading"><span className="pill">Учебный сценарий</span><button className="icon-button" aria-label="Закрыть оплату" onClick={close}><Icon name="close" /></button></div>
        <h2 id="tuition-confirm-title">Демонстрационная оплата</h2>
        <p className="tuition-dialog-amount">{money(selected.amount_kopecks)}</p>
        <p>{selected.title}</p><p className="small muted">Договор {selected.contract_number}</p>
        <p className="tuition-dialog-note">Деньги не спишутся. Мы отметим учебный счёт оплаченным и сохраним подтверждение в истории. Данные банковской карты не нужны.</p>
        {error && <p className="form-error" role="alert">Не удалось подтвердить оплату. Проверьте соединение и повторите. Повторная попытка не создаст второй платёж.</p>}
        <div className="tuition-dialog-actions"><button className="button primary" disabled={pending} onClick={confirm}>{pending ? "Подтверждаем…" : "Подтвердить демо-оплату"}</button>
          <button className="button secondary" onClick={close}>Отмена</button></div>
      </div>}
    </dialog>
  </div>;
}
