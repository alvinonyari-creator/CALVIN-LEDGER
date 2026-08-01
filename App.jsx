import { useState, useEffect, useMemo } from "react";
import {
  Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Home, GraduationCap, Stethoscope,
  ShoppingBag, Popcorn, Shirt, BookOpen, UserCheck, ShoppingCart, Store, Zap, Wifi,
  FileText, MoreHorizontal, WifiOff,
} from "lucide-react";
import { supabase } from "./supabaseClient";

const CATEGORIES = [
  { key: "Rent", label: "Rent", icon: Home, color: "#8B5E34" },
  { key: "School fees", label: "School fees", icon: GraduationCap, color: "#3B6E71" },
  { key: "Books and Stationery", label: "Books and Stationery", icon: BookOpen, color: "#7A8B4A" },
  { key: "House Help Salary", label: "House Help Salary", icon: UserCheck, color: "#8A6B9C" },
  { key: "Groceries", label: "Groceries", icon: ShoppingCart, color: "#5C8B5A" },
  { key: "House Shopping", label: "House Shopping", icon: Store, color: "#4A7B9C" },
  { key: "Electricity", label: "Electricity", icon: Zap, color: "#B89B2A" },
  { key: "Internet", label: "Internet", icon: Wifi, color: "#3D8A8A" },
  { key: "Medical", label: "Medical", icon: Stethoscope, color: "#A13D3D" },
  { key: "Shopping", label: "Shopping", icon: ShoppingBag, color: "#6B5A9C" },
  { key: "Entertainment", label: "Entertainment", icon: Popcorn, color: "#B8863B" },
  { key: "Clothing", label: "Clothing", icon: Shirt, color: "#3D6B8A" },
  { key: "Miscellaneous", label: "Miscellaneous", icon: MoreHorizontal, color: "#5A5A5A" },
];

const RECIPIENTS = ["Calvin", "Lydia", "Both"];

// Monthly rent budget, and school fees budget per term.
// Real school calendar: Term 1 Sep–Nov, Term 2 Jan–Mar, Term 3 May–Jul.
// April, August, and December are holidays with no active term.
const BUDGETS = { Rent: 50000, "School fees": 150000 };
const TERM_DEFS = [
  { name: "Term 1", months: [9, 10, 11] },
  { name: "Term 2", months: [1, 2, 3] },
  { name: "Term 3", months: [5, 6, 7] },
];

function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function fmt(n) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}
function nowDateTimeStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toDatetimeLocalValue(dateStr) {
  if (!dateStr) return nowDateTimeStr();
  return dateStr.length === 10 ? `${dateStr}T00:00` : dateStr.slice(0, 16);
}
function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function termForMonth(mKey) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m] = mKey.split("-").map(Number);
  const def = TERM_DEFS.find((t) => t.months.includes(m));
  if (!def) return null;
  const months = def.months.map((mm) => `${y}-${String(mm).padStart(2, "0")}`);
  const first = def.months[0];
  const last = def.months[def.months.length - 1];
  const label = `${def.name} (${monthNames[first - 1]}–${monthNames[last - 1]} ${y})`;
  return { months, label };
}
function monthSeq(mKey) {
  const [y, m] = mKey.split("-").map(Number);
  return y * 12 + (m - 1);
}
function termSeq(mKey) {
  const [y, m] = mKey.split("-").map(Number);
  if ([9, 10, 11].includes(m)) return y * 3;
  if ([1, 2, 3].includes(m)) return (y - 1) * 3 + 1;
  if ([5, 6, 7].includes(m)) return (y - 1) * 3 + 2;
  return null;
}
function termLabelFromSeq(idx) {
  const academicYear = Math.floor(idx / 3);
  const rem = idx % 3;
  const repMonth = rem === 0 ? `${academicYear}-09` : rem === 1 ? `${academicYear + 1}-01` : `${academicYear + 1}-05`;
  return termForMonth(repMonth);
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [viewMonth, setViewMonth] = useState(monthKey(nowDateTimeStr()));
  const [showForm, setShowForm] = useState(false);
  const [showObligations, setShowObligations] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: "", category: "Rent", recipient: "Calvin", note: "", date: nowDateTimeStr() });
  const [showNewObligationForm, setShowNewObligationForm] = useState(false);
  const [obligationForm, setObligationForm] = useState({ title: "", category: "Miscellaneous", totalAmount: "" });
  const [payingId, setPayingId] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", date: nowDateTimeStr() });

  async function loadEntries() {
    const { data, error: err } = await supabase.from("expenses").select("*").order("date", { ascending: false });
    if (err) setError("Couldn't load entries. Check your connection.");
    else { setEntries(data || []); setError(null); }
  }
  async function loadObligations() {
    const { data, error: err } = await supabase.from("obligations").select("*").order("created_at", { ascending: false });
    if (!err) setObligations(data || []);
  }

  useEffect(() => {
    (async () => {
      await loadEntries();
      await loadObligations();
      setLoaded(true);
    })();
    const ch1 = supabase.channel("expenses-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, loadEntries)
      .subscribe();
    const ch2 = supabase.channel("obligations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "obligations" }, loadObligations)
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, []);

  async function saveEntry(e) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    const payload = { amount: amt, category: form.category, recipient: form.recipient, note: form.note.trim(), date: form.date };
    const { error: err } = editingId
      ? await supabase.from("expenses").update(payload).eq("id", editingId)
      : await supabase.from("expenses").insert(payload);
    setSaving(false);
    if (err) { setError("Save failed. Entry was not recorded — check your connection and try again."); return; }
    setError(null);
    setForm({ amount: "", category: "Rent", recipient: "Calvin", note: "", date: nowDateTimeStr() });
    setEditingId(null);
    setShowForm(false);
    loadEntries();
  }

  function startEdit(entry) {
    setForm({
      amount: String(entry.amount),
      category: entry.category,
      recipient: entry.recipient,
      note: entry.note || "",
      date: toDatetimeLocalValue(entry.date),
    });
    setEditingId(entry.id);
    setShowForm(true);
  }
  function startNew() {
    setForm({ amount: "", category: "Rent", recipient: "Calvin", note: "", date: nowDateTimeStr() });
    setEditingId(null);
    setShowForm(true);
  }
  async function deleteEntry(id) {
    const { error: err } = await supabase.from("expenses").delete().eq("id", id);
    if (err) { setError("Delete failed. Try again."); return; }
    loadEntries();
  }

  async function addObligation(e) {
    e.preventDefault();
    const amt = parseFloat(obligationForm.totalAmount);
    if (!obligationForm.title.trim() || !amt || amt <= 0) return;
    const { error: err } = await supabase.from("obligations").insert({
      title: obligationForm.title.trim(),
      category: obligationForm.category,
      total_amount: amt,
    });
    if (err) { setError("Couldn't save the obligation. Try again."); return; }
    setObligationForm({ title: "", category: "Miscellaneous", totalAmount: "" });
    setShowNewObligationForm(false);
    loadObligations();
  }
  async function deleteObligation(id) {
    const { error: err } = await supabase.from("obligations").delete().eq("id", id);
    if (!err) loadObligations();
  }
  function obligationPaid(obligationId) {
    return entries.filter((e) => e.obligation_id === obligationId).reduce((s, e) => s + e.amount, 0);
  }
  async function addPayment(obligation, e) {
    e.preventDefault();
    const amt = parseFloat(paymentForm.amount);
    if (!amt || amt <= 0) return;
    const { error: err } = await supabase.from("expenses").insert({
      amount: amt,
      category: obligation.category,
      recipient: "Both",
      note: `Payment toward ${obligation.title}`,
      date: paymentForm.date,
      obligation_id: obligation.id,
    });
    if (err) { setError("Payment failed to save. Try again."); return; }
    setPaymentForm({ amount: "", date: nowDateTimeStr() });
    setPayingId(null);
    loadEntries();
  }

  const months = useMemo(() => {
    const set = new Set(entries.map((e) => monthKey(e.date)));
    set.add(viewMonth);
    return Array.from(set).sort();
  }, [entries, viewMonth]);

  const monthEntries = entries.filter((e) => monthKey(e.date) === viewMonth);
  const monthTotal = monthEntries.reduce((s, e) => s + Number(e.amount), 0);

  const byCategory = CATEGORIES.map((c) => ({
    ...c,
    total: monthEntries.filter((e) => e.category === c.key).reduce((s, e) => s + Number(e.amount), 0),
  })).filter((c) => c.total > 0);

  const reportData = CATEGORIES.map((c) => {
    const catEntries = monthEntries.filter((e) => e.category === c.key);
    return { ...c, total: catEntries.reduce((s, e) => s + Number(e.amount), 0), count: catEntries.length };
  });

  const rentEntries = entries.filter((e) => e.category === "Rent");
  const rentStartSeq = rentEntries.length ? Math.min(...rentEntries.map((e) => monthSeq(monthKey(e.date)))) : monthSeq(viewMonth);
  const viewSeq = monthSeq(viewMonth);
  const rentPeriodsElapsed = Math.max(1, viewSeq - rentStartSeq + 1);
  const rentCumulativeBudget = BUDGETS.Rent * rentPeriodsElapsed;
  const rentCumulativeSpent = rentEntries
    .filter((e) => { const s = monthSeq(monthKey(e.date)); return s >= rentStartSeq && s <= viewSeq; })
    .reduce((s, e) => s + Number(e.amount), 0);
  const rentRemaining = rentCumulativeBudget - rentCumulativeSpent;
  const rentStartLabel = monthLabel(`${Math.floor(rentStartSeq / 12)}-${String((rentStartSeq % 12) + 1).padStart(2, "0")}`);

  const term = termForMonth(viewMonth);
  const schoolEntries = entries.filter((e) => e.category === "School fees");
  const schoolEntryTermSeqs = schoolEntries.map((e) => termSeq(monthKey(e.date))).filter((s) => s !== null);
  const currentTermSeq = term ? termSeq(viewMonth) : null;
  let schoolRemaining = null, schoolCumulativeSpent = 0, schoolCumulativeBudget = 0, schoolTermsElapsed = 0, schoolStartLabel = "";
  if (term && currentTermSeq !== null) {
    const schoolStartSeq = schoolEntryTermSeqs.length ? Math.min(...schoolEntryTermSeqs, currentTermSeq) : currentTermSeq;
    schoolTermsElapsed = Math.max(1, currentTermSeq - schoolStartSeq + 1);
    schoolCumulativeBudget = BUDGETS["School fees"] * schoolTermsElapsed;
    schoolCumulativeSpent = schoolEntries
      .filter((e) => { const s = termSeq(monthKey(e.date)); return s !== null && s >= schoolStartSeq && s <= currentTermSeq; })
      .reduce((s, e) => s + Number(e.amount), 0);
    schoolRemaining = schoolCumulativeBudget - schoolCumulativeSpent;
    schoolStartLabel = termLabelFromSeq(schoolStartSeq)?.label || "";
  }

  function shiftMonth(delta) {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const maxCatTotal = Math.max(1, ...byCategory.map((c) => c.total));

  return (
    <div style={{ minHeight: "100vh", background: "#12203B", fontFamily: "'Iowan Old Style', Georgia, serif", color: "#F4EFE4" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 18px 100px" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C9A227", marginBottom: 4 }}>
            Expense Tracker
          </div>
          <h1 style={{ fontSize: 30, margin: 0, fontWeight: 500 }}>Calvin &amp; Lydia</h1>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={() => setShowObligations((v) => !v)} style={{ background: showObligations ? "#C9A227" : "transparent", color: showObligations ? "#12203B" : "#C9A227", border: "1px solid #C9A227", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {showObligations ? "Hide obligations" : "View obligations"}
            </button>
            <button onClick={() => setShowReport((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: showReport ? "#4A7B9C" : "transparent", color: showReport ? "#12203B" : "#7FB0D6", border: "1px solid #4A7B9C", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <FileText size={14} />
              {showReport ? "Hide report" : "Monthly report"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#4A2020", color: "#F4C9C9", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <WifiOff size={14} /> {error}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1B2A4A", borderRadius: 12, padding: "10px 8px", marginBottom: 18, border: "1px solid #2A3D63" }}>
          <button onClick={() => shiftMonth(-1)} style={iconBtnStyle} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{monthLabel(viewMonth)}</div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 20, color: "#C9A227", fontVariantNumeric: "tabular-nums" }}>{fmt(monthTotal)}</div>
          </div>
          <button onClick={() => shiftMonth(1)} style={iconBtnStyle} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>

        {showReport && (
          <div style={{ marginBottom: 22, background: "#16233F", border: "1px solid #2A3D63", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7FB0D6", marginBottom: 2 }}>Monthly report</div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>{monthLabel(viewMonth)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {reportData.map((c) => (
                <div key={c.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid #1F2E4E" }}>
                  <span style={{ color: c.total > 0 ? "#F4EFE4" : "#5C6B8A" }}>{c.label}{c.count > 0 ? ` (${c.count})` : ""}</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums", color: c.total > 0 ? "#F4EFE4" : "#5C6B8A" }}>{fmt(c.total)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 600, marginTop: 12, paddingTop: 10, borderTop: "1px solid #2A3D63" }}>
              <span>Total spent</span>
              <span style={{ fontFamily: "ui-monospace, monospace", color: "#C9A227" }}>{fmt(monthTotal)}</span>
            </div>
          </div>
        )}

        {showObligations && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7C89A8", marginBottom: 10 }}>Remaining toward obligations</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ background: "#1B2A4A", border: "1px solid #263A5F", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#9AA7C2", marginBottom: 4 }}>
                  <span>Rent — since {rentStartLabel}</span>
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{fmt(rentCumulativeSpent)} / {fmt(rentCumulativeBudget)}</span>
                </div>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, fontVariantNumeric: "tabular-nums", color: rentRemaining > 0 ? "#E08585" : "#8FC9A0" }}>
                  {rentRemaining < 0 ? `${fmt(Math.abs(rentRemaining))} credit carried forward` : `${fmt(rentRemaining)} owed`}
                </div>
                {rentPeriodsElapsed > 1 && <div style={{ fontSize: 11, color: "#7C89A8", marginTop: 2 }}>{rentPeriodsElapsed} months tracked</div>}
              </div>
              <div style={{ background: "#1B2A4A", border: "1px solid #263A5F", borderRadius: 10, padding: "12px 14px" }}>
                {term ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#9AA7C2", marginBottom: 4 }}>
                      <span>School fees — since {schoolStartLabel}</span>
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>{fmt(schoolCumulativeSpent)} / {fmt(schoolCumulativeBudget)}</span>
                    </div>
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, fontVariantNumeric: "tabular-nums", color: schoolRemaining > 0 ? "#E08585" : "#8FC9A0" }}>
                      {schoolRemaining < 0 ? `${fmt(Math.abs(schoolRemaining))} credit carried forward` : `${fmt(schoolRemaining)} owed`}
                    </div>
                    {schoolTermsElapsed > 1 && <div style={{ fontSize: 11, color: "#7C89A8", marginTop: 2 }}>{schoolTermsElapsed} terms tracked</div>}
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#7C89A8" }}>School holiday — no term active in {monthLabel(viewMonth)}.</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7C89A8", marginBottom: 10 }}>Other obligations</div>
              {obligations.length === 0 && <div style={{ fontSize: 13, color: "#7C89A8", marginBottom: 10 }}>No upcoming expenses logged yet.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {obligations.map((o) => {
                  const paid = obligationPaid(o.id);
                  const remaining = Number(o.total_amount) - paid;
                  const cat = CATEGORIES.find((c) => c.key === o.category) || CATEGORIES.find((c) => c.key === "Miscellaneous");
                  const Icon = cat.icon;
                  return (
                    <div key={o.id} style={{ background: "#1B2A4A", border: "1px solid #263A5F", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                          <Icon size={14} color={cat.color === "#5A5A5A" ? "#B8B8B8" : cat.color} />
                          <span>{o.title}</span>
                        </div>
                        <button onClick={() => deleteObligation(o.id)} style={{ ...iconBtnStyle, color: "#A66" }} aria-label="Delete obligation"><Trash2 size={14} /></button>
                      </div>
                      <div style={{ fontSize: 12, color: "#9AA7C2", marginBottom: 4, fontFamily: "ui-monospace, monospace" }}>{fmt(paid)} / {fmt(o.total_amount)}</div>
                      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 16, fontVariantNumeric: "tabular-nums", color: remaining > 0 ? "#E08585" : "#8FC9A0", marginBottom: 8 }}>
                        {remaining < 0 ? `${fmt(Math.abs(remaining))} overpaid` : `${fmt(remaining)} remaining`}
                      </div>
                      {payingId === o.id ? (
                        <form onSubmit={(e) => addPayment(o, e)} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <input type="number" step="0.01" placeholder="Payment amount" value={paymentForm.amount} onChange={(ev) => setPaymentForm({ ...paymentForm, amount: ev.target.value })} style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }} autoFocus required />
                          <input type="datetime-local" value={paymentForm.date} onChange={(ev) => setPaymentForm({ ...paymentForm, date: ev.target.value })} style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }} />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" onClick={() => setPayingId(null)} style={{ ...ghostBtn, flex: 1, padding: "8px 0", fontSize: 13 }}>Cancel</button>
                            <button type="submit" style={{ ...primaryBtn, flex: 2, padding: "8px 0", fontSize: 13 }}>Add payment</button>
                          </div>
                        </form>
                      ) : (
                        remaining > 0 && (
                          <button onClick={() => { setPaymentForm({ amount: "", date: nowDateTimeStr() }); setPayingId(o.id); }} style={{ ...ghostBtn, width: "100%", padding: "8px 0", fontSize: 13 }}>Add payment</button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>

              {showNewObligationForm ? (
                <form onSubmit={addObligation} style={{ marginTop: 10, background: "#1B2A4A", border: "1px solid #2A3D63", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <input type="text" placeholder="What's the expense (e.g. car repair)" value={obligationForm.title} onChange={(ev) => setObligationForm({ ...obligationForm, title: ev.target.value })} style={{ ...inputStyle, fontSize: 13 }} autoFocus required />
                  <select value={obligationForm.category} onChange={(ev) => setObligationForm({ ...obligationForm, category: ev.target.value })} style={{ ...inputStyle, fontSize: 13 }}>
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="Total amount" value={obligationForm.totalAmount} onChange={(ev) => setObligationForm({ ...obligationForm, totalAmount: ev.target.value })} style={{ ...inputStyle, fontSize: 13 }} required />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => setShowNewObligationForm(false)} style={{ ...ghostBtn, flex: 1, padding: "8px 0", fontSize: 13 }}>Cancel</button>
                    <button type="submit" style={{ ...primaryBtn, flex: 2, padding: "8px 0", fontSize: 13 }}>Save</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowNewObligationForm(true)} style={{ ...ghostBtn, width: "100%", marginTop: 10, fontSize: 13, padding: "10px 0" }}>
                  <Plus size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                  New upcoming expense
                </button>
              )}
            </div>
          </div>
        )}

        {byCategory.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7C89A8", marginBottom: 10 }}>By category</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {byCategory.sort((a, b) => b.total - a.total).map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: c.color + "33", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={14} color={c.color === "#5A5A5A" ? "#B8B8B8" : c.color} strokeWidth={2} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                        <span>{c.label}</span>
                        <span style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums" }}>{fmt(c.total)}</span>
                      </div>
                      <div style={{ height: 5, background: "#0E1930", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(c.total / maxCatTotal) * 100}%`, background: c.color, borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7C89A8", marginBottom: 10 }}>Entries</div>
        {!loaded ? (
          <div style={{ color: "#7C89A8", fontSize: 14 }}>Loading…</div>
        ) : monthEntries.length === 0 ? (
          <div style={{ color: "#7C89A8", fontSize: 14, padding: "20px 0" }}>Nothing logged for {monthLabel(viewMonth)} yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {monthEntries.map((e) => {
              const cat = CATEGORIES.find((c) => c.key === e.category) || CATEGORIES.find((c) => c.key === "Miscellaneous");
              const Icon = cat.icon;
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#1B2A4A", border: "1px solid #263A5F", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: cat.color + "33", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={15} color={cat.color === "#5A5A5A" ? "#B8B8B8" : cat.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note || cat.label}</span>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(e.amount)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#7C89A8", marginTop: 2 }}>{formatDateTime(e.date)} · {cat.label} · {e.recipient}</div>
                  </div>
                  <button onClick={() => startEdit(e)} style={iconBtnStyle} aria-label="Edit entry"><Pencil size={14} /></button>
                  <button onClick={() => deleteEntry(e.id)} style={{ ...iconBtnStyle, color: "#A66" }} aria-label="Delete entry"><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center", padding: 16, background: "linear-gradient(transparent, #12203B 40%)" }}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          {showForm ? (
            <form onSubmit={saveEntry} style={{ background: "#1B2A4A", border: "1px solid #2A3D63", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <input type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(ev) => setForm({ ...form, amount: ev.target.value })} style={inputStyle} autoFocus required />
              <input type="datetime-local" value={form.date} onChange={(ev) => setForm({ ...form, date: ev.target.value })} style={inputStyle} />
              <select value={form.category} onChange={(ev) => setForm({ ...form, category: ev.target.value })} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                {RECIPIENTS.map((r) => (
                  <button type="button" key={r} onClick={() => setForm({ ...form, recipient: r })} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: form.recipient === r ? "1px solid #C9A227" : "1px solid #2A3D63", background: form.recipient === r ? "#C9A22722" : "transparent", color: form.recipient === r ? "#C9A227" : "#9AA7C2", fontSize: 13, cursor: "pointer" }}>{r}</button>
                ))}
              </div>
              <input type="text" placeholder="Note (e.g. summer camp deposit)" value={form.note} onChange={(ev) => setForm({ ...form, note: ev.target.value })} style={inputStyle} />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ ...primaryBtn, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : editingId ? "Save changes" : "Save entry"}</button>
              </div>
            </form>
          ) : (
            <button onClick={startNew} style={primaryBtn}>
              <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
              Log an expense
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const iconBtnStyle = { background: "transparent", border: "none", color: "#9AA7C2", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", justifyContent: "center" };
const inputStyle = { flex: 1, background: "#0E1930", border: "1px solid #2A3D63", borderRadius: 8, padding: "10px 12px", color: "#F4EFE4", fontSize: 14, fontFamily: "inherit", outline: "none" };
const primaryBtn = { width: "100%", background: "#C9A227", color: "#12203B", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 600, cursor: "pointer" };
const ghostBtn = { background: "transparent", color: "#9AA7C2", border: "1px solid #2A3D63", borderRadius: 12, padding: "14px 0", fontSize: 15, cursor: "pointer" };
