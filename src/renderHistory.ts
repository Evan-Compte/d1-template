import { layout, escapeHtml, formatMoney } from "./layout";

interface Transaction {
	id: number;
	amount: number;
	description: string;
	date: string;
	type: string;
	category_name: string;
	icon: string;
}

export async function renderHistoryPage(
	env: Env,
	opts: { from?: string; to?: string; category?: string; type?: string }
): Promise<string> {
	const from = opts.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1)
		.toISOString().slice(0, 10);
	const to = opts.to || new Date().toISOString().slice(0, 10);
	const categoryId = opts.category ? parseInt(opts.category) : null;
	const typeFilter = opts.type || "";

	const conditions: string[] = ["t.date BETWEEN ? AND ?"];
	const params: (string | number)[] = [from, to];
	if (categoryId) {
		conditions.push("t.category_id = ?");
		params.push(categoryId);
	}
	if (typeFilter) {
		conditions.push("t.type = ?");
		params.push(typeFilter);
	}

	const sql = `SELECT t.id, t.amount, t.description, t.date, t.type, c.name as category_name, c.icon
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY t.date DESC, t.id DESC`;
	const transactions = await env.DB.prepare(sql).bind(...params).all();
	const categories = await env.DB.prepare("SELECT id, name, type FROM categories ORDER BY type, name").all();

	const settings = await env.DB.prepare("SELECT key, value FROM settings").all();
	const settingsMap = Object.fromEntries(
		(settings.results as { key: string; value: string }[]).map((r) => [r.key, r.value])
	);
	const currency = settingsMap.currency || "EUR";
	const appName = settingsMap.app_name || "Mon Budget Personnel";

	const totalIncome = (transactions.results as Transaction[])
		.filter((t) => t.type === "income")
		.reduce((s, t) => s + t.amount, 0);
	const totalExpense = (transactions.results as Transaction[])
		.filter((t) => t.type === "expense")
		.reduce((s, t) => s + t.amount, 0);

	return layout({
		title: "Historique",
		appName,
		currentPath: "/historique",
		content: `
    <form method="get" action="/historique" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;align-items:end;">
      <div>
        <label>Du</label>
        <input type="date" name="from" value="${escapeHtml(from)}" />
      </div>
      <div>
        <label>Au</label>
        <input type="date" name="to" value="${escapeHtml(to)}" />
      </div>
      <div>
        <label>Type</label>
        <select name="type">
          <option value="">Tous</option>
          <option value="income" ${typeFilter === "income" ? "selected" : ""}>Revenus</option>
          <option value="expense" ${typeFilter === "expense" ? "selected" : ""}>Dépenses</option>
        </select>
      </div>
      <div>
        <label>Catégorie</label>
        <select name="category">
          <option value="">Toutes</option>
          ${(categories.results as { id: number; name: string; type: string }[])
				.map(
					(c) =>
						`<option value="${c.id}" ${categoryId === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`
				)
				.join("")}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Filtrer</button>
    </form>

    <div style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap;">
      <div style="background:var(--surface);border-radius:10px;padding:0.75rem 1rem;border:1px solid var(--border);">
        <span style="font-size:0.75rem;color:var(--text-muted)">Revenus</span>
        <div style="color:var(--income);font-family:JetBrains Mono;font-weight:600">+${formatMoney(totalIncome, currency)}</div>
      </div>
      <div style="background:var(--surface);border-radius:10px;padding:0.75rem 1rem;border:1px solid var(--border);">
        <span style="font-size:0.75rem;color:var(--text-muted)">Dépenses</span>
        <div style="color:var(--expense);font-family:JetBrains Mono;font-weight:600">-${formatMoney(totalExpense, currency)}</div>
      </div>
      <div style="background:var(--surface);border-radius:10px;padding:0.75rem 1rem;border:1px solid var(--border);">
        <span style="font-size:0.75rem;color:var(--text-muted)">Solde</span>
        <div style="color:${totalIncome - totalExpense >= 0 ? "var(--income)" : "var(--expense)"};font-family:JetBrains Mono;font-weight:600">${formatMoney(totalIncome - totalExpense, currency)}</div>
      </div>
    </div>

    <h2 class="section-title">Transactions</h2>
    <div class="tx-list" style="display:flex;flex-direction:column;gap:0.5rem;">
      ${
				transactions.results.length === 0
					? '<div class="empty">Aucune transaction pour cette période.</div>'
					: (transactions.results as Transaction[]).map(renderTx).join("")
			}
    </div>
  `,
		scripts: `
    async function deleteTx(id) {
      if (!confirm('Supprimer cette transaction ?')) return;
      await fetch('/api/transactions/' + id, { method: 'DELETE' });
      location.reload();
    }
    window.deleteTx = deleteTx;
  `,
	});
}

function renderTx(t: Transaction): string {
	const amountClass = t.type === "income" ? "income" : "expense";
	const dateFormatted = new Date(t.date).toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
	return `
    <div class="tx-item" style="display:flex;align-items:center;justify-content:space-between;padding:1rem;background:var(--surface);border:1px solid var(--border);border-radius:10px;gap:1rem;">
      <div style="display:flex;align-items:center;gap:1rem;flex:1;min-width:0;">
        <span style="font-size:1.5rem">${escapeHtml(t.icon)}</span>
        <div>
          <div style="font-weight:500">${escapeHtml(t.description)}</div>
          <div style="font-size:0.8rem;color:var(--text-muted)">${escapeHtml(t.category_name)} · ${dateFormatted}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span style="font-family:JetBrains Mono;font-weight:600;white-space:nowrap;color:${t.type === "income" ? "var(--income)" : "var(--expense)"}">${t.type === "income" ? "+" : "-"}${formatMoney(t.amount, currency)}</span>
        <button type="button" class="btn btn-danger" onclick="deleteTx(${t.id})">Suppr.</button>
      </div>
    </div>`;
}
