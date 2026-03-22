import { layout, escapeHtml, formatMoney } from "./layout";

interface Category {
	id: number;
	name: string;
	type: "income" | "expense";
	color: string;
	icon: string;
}

interface Transaction {
	id: number;
	amount: number;
	description: string;
	date: string;
	type: "income" | "expense";
	category_name: string;
	icon: string;
	color: string;
}

export async function renderBudgetApp(
	env: Env,
	opts: { error?: string; added?: boolean }
): Promise<string> {
	const categories = await env.DB.prepare(
		"SELECT id, name, type, color, icon FROM categories ORDER BY type, name"
	).all();

	const transactions = await env.DB.prepare(
		`SELECT t.id, t.amount, t.description, t.date, t.type, c.name as category_name, c.icon, c.color
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     ORDER BY t.date DESC, t.id DESC
     LIMIT 50`
	).all();

	const stats = await env.DB.prepare(
		`SELECT 
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
     FROM transactions
     WHERE date >= date('now', 'start of month')`
	).first<{ total_income: number; total_expense: number }>();

	const income = stats?.total_income ?? 0;
	const expenses = stats?.total_expense ?? 0;
	const balance = income - expenses;

	const incomeCategories = (categories.results as Category[]).filter((c) => c.type === "income");
	const expenseCategories = (categories.results as Category[]).filter((c) => c.type === "expense");

	const settings = await env.DB.prepare("SELECT key, value FROM settings").all();
	const settingsMap = Object.fromEntries(
		(settings.results as { key: string; value: string }[]).map((r) => [r.key, r.value])
	);
	const currency = settingsMap.currency || "EUR";
	const appName = settingsMap.app_name || "Mon Budget Personnel";

	return layout({
		title: "Budget",
		appName,
		currentPath: "/",
		content: `
    <style>
      .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
      @media (max-width: 520px) { .cards { grid-template-columns: 1fr; } }
      .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; }
      .card-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.25rem; }
      .card-value { font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 600; }
      .card.income .card-value { color: var(--income); }
      .card.expense .card-value { color: var(--expense); }
      .card.balance .card-value { color: ${balance >= 0 ? "var(--income)" : "var(--expense)"}; }
      .type-tabs { display: flex; gap: 0.5rem; margin-bottom: 0.35rem; }
      .type-tab { padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); cursor: pointer; font-size: 0.9rem; }
      .type-tab.active { background: var(--accent-dim); border-color: var(--accent); color: white; }
      .type-tab:not(.active):hover { background: var(--surface-hover); color: var(--text); }
      .tx-list { display: flex; flex-direction: column; gap: 0.5rem; }
      .tx-item { display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; gap: 1rem; }
      .tx-item:hover { border-color: var(--accent-dim); }
      .tx-info { display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0; }
      .tx-icon { font-size: 1.5rem; }
      .tx-desc { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tx-meta { font-size: 0.8rem; color: var(--text-muted); }
      .tx-amount { font-family: 'JetBrains Mono', monospace; font-weight: 600; white-space: nowrap; }
      .tx-amount.income { color: var(--income); }
      .tx-amount.expense { color: var(--expense); }
      form.budget-form { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; display: grid; gap: 1rem; }
    </style>

    ${opts.error ? `<div class="error">${escapeHtml(opts.error)}</div>` : ""}
    ${opts.added ? '<div class="success">Transaction ajoutée avec succès.</div>' : ""}

    <div class="cards">
      <div class="card income">
        <div class="card-label">Revenus (ce mois)</div>
        <div class="card-value">${formatMoney(income, currency)}</div>
      </div>
      <div class="card expense">
        <div class="card-label">Dépenses (ce mois)</div>
        <div class="card-value">${formatMoney(expenses, currency)}</div>
      </div>
      <div class="card balance">
        <div class="card-label">Solde</div>
        <div class="card-value">${formatMoney(balance, currency)}</div>
      </div>
    </div>

    <section class="section">
      <h2 class="section-title">Nouvelle transaction</h2>
      <form method="post" action="/transactions" class="budget-form">
        <div>
          <label>Type</label>
          <div class="type-tabs">
            <button type="button" class="type-tab active" data-type="expense">Dépense</button>
            <button type="button" class="type-tab" data-type="income">Revenu</button>
          </div>
          <input type="hidden" name="type" value="expense" id="typeInput" />
        </div>
        <div class="form-row">
          <div>
            <label>Montant</label>
            <input type="number" name="amount" step="0.01" min="0" required placeholder="0.00" />
          </div>
          <div>
            <label>Date</label>
            <input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" />
          </div>
        </div>
        <div>
          <label>Description</label>
          <input type="text" name="description" placeholder="Ex: Courses supermarché" required />
        </div>
        <div>
          <label>Catégorie</label>
          <select name="category" id="categorySelect">
            ${expenseCategories
							.map(
								(c) =>
									`<option value="${c.id}" data-type="expense">${c.icon} ${c.name}</option>`
							)
							.join("")}
            ${incomeCategories
							.map(
								(c) =>
									`<option value="${c.id}" data-type="income">${c.icon} ${c.name}</option>`
							)
							.join("")}
          </select>
        </div>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </form>
    </section>

    <section class="section">
      <h2 class="section-title">Dernières transactions</h2>
      <div class="tx-list">
        ${
					transactions.results.length === 0
						? '<div class="empty">Aucune transaction pour le moment. Ajoutez-en une ci-dessus !</div>'
						: (transactions.results as Transaction[]).map((t) => renderTx(t, currency)).join("")
				}
      </div>
    </section>
  `,
		scripts: `
    const typeTabs = document.querySelectorAll('.type-tab');
    const typeInput = document.getElementById('typeInput');
    const categorySelect = document.getElementById('categorySelect');
    const categories = ${JSON.stringify(categories.results)};

    typeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const type = tab.dataset.type;
        typeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        typeInput.value = type;
        const opts = categorySelect.querySelectorAll('option');
        opts.forEach(o => { o.style.display = o.dataset.type === type ? '' : 'none'; });
        const first = categorySelect.querySelector('option[data-type="' + type + '"]');
        if (first) categorySelect.value = first.value;
      });
    });

    async function deleteTx(id) {
      if (!confirm('Supprimer cette transaction ?')) return;
      await fetch('/api/transactions/' + id, { method: 'DELETE' });
      location.reload();
    }
    window.deleteTx = deleteTx;
  `,
	});
}

function renderTx(t: Transaction, currency: string): string {
	const amountClass = t.type === "income" ? "income" : "expense";
	const dateFormatted = new Date(t.date).toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "short",
	});
	return `
    <div class="tx-item">
      <div class="tx-info">
        <span class="tx-icon">${escapeHtml(t.icon)}</span>
        <div class="tx-details">
          <div class="tx-desc">${escapeHtml(t.description)}</div>
          <div class="tx-meta">${escapeHtml(t.category_name)} · ${dateFormatted}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span class="tx-amount ${amountClass}">${t.type === "income" ? "+" : "-"}${formatMoney(t.amount, currency)}</span>
        <button type="button" class="btn btn-danger" onclick="deleteTx(${t.id})">Suppr.</button>
      </div>
    </div>
  `;
}
