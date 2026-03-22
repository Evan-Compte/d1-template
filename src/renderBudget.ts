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

	return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mon Budget Personnel</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f0f12;
      --surface: #1a1a1f;
      --surface-hover: #222228;
      --border: #2a2a32;
      --text: #e4e4e7;
      --text-muted: #71717a;
      --accent: #a78bfa;
      --accent-dim: #7c3aed;
      --income: #4ade80;
      --expense: #f87171;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.5;
    }
    .container { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 2rem;
      background: linear-gradient(135deg, var(--text) 0%, var(--text-muted) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
    @media (max-width: 520px) { .cards { grid-template-columns: 1fr; } }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
    }
    .card-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.25rem; }
    .card-value { font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 600; }
    .card.income .card-value { color: var(--income); }
    .card.expense .card-value { color: var(--expense); }
    .card.balance .card-value { color: ${balance >= 0 ? "var(--income)" : "var(--expense)"}; }
    .section { margin-bottom: 2rem; }
    .section-title { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--text-muted); }
    form {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      display: grid;
      gap: 1rem;
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 520px) { .form-row { grid-template-columns: 1fr; } }
    label { font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 0.35rem; }
    input, select {
      width: 100%;
      padding: 0.6rem 0.85rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-family: inherit;
      font-size: 0.95rem;
    }
    input:focus, select:focus { outline: none; border-color: var(--accent); }
    .type-tabs { display: flex; gap: 0.5rem; margin-bottom: 0.35rem; }
    .type-tab {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.9rem;
    }
    .type-tab.active { background: var(--accent-dim); border-color: var(--accent); color: white; }
    .type-tab:not(.active):hover { background: var(--surface-hover); color: var(--text); }
    .btn {
      padding: 0.7rem 1.25rem;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-primary { background: var(--accent); color: white; }
    .btn-primary:hover { background: var(--accent-dim); }
    .btn-danger { background: #7f1d1d; color: #fca5a5; font-size: 0.75rem; padding: 0.4rem 0.7rem; }
    .btn-danger:hover { background: #991b1b; }
    .error { background: #7f1d1d; color: #fca5a5; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
    .success { background: #14532d; color: #86efac; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
    .tx-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .tx-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      gap: 1rem;
    }
    .tx-item:hover { border-color: var(--accent-dim); }
    .tx-info { display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0; }
    .tx-icon { font-size: 1.5rem; }
    .tx-details {}
    .tx-desc { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tx-meta { font-size: 0.8rem; color: var(--text-muted); }
    .tx-amount { font-family: 'JetBrains Mono', monospace; font-weight: 600; white-space: nowrap; }
    .tx-amount.income { color: var(--income); }
    .tx-amount.expense { color: var(--expense); }
    .empty { text-align: center; padding: 2rem; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Mon Budget Personnel</h1>

    ${opts.error ? `<div class="error">${opts.error}</div>` : ""}
    ${opts.added ? '<div class="success">Transaction ajoutée avec succès.</div>' : ""}

    <div class="cards">
      <div class="card income">
        <div class="card-label">Revenus (ce mois)</div>
        <div class="card-value">${formatMoney(income)}</div>
      </div>
      <div class="card expense">
        <div class="card-label">Dépenses (ce mois)</div>
        <div class="card-value">${formatMoney(expenses)}</div>
      </div>
      <div class="card balance">
        <div class="card-label">Solde</div>
        <div class="card-value">${formatMoney(balance)}</div>
      </div>
    </div>

    <section class="section">
      <h2 class="section-title">Nouvelle transaction</h2>
      <form method="post" action="/transactions">
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
            <label>Montant (€)</label>
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
						: (transactions.results as Transaction[]).map(renderTx).join("")
				}
      </div>
    </section>
  </div>

  <script>
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
        opts.forEach(o => {
          o.style.display = o.dataset.type === type ? '' : 'none';
        });
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
  </script>
</body>
</html>`;
}

function formatMoney(n: number): string {
	return new Intl.NumberFormat("fr-FR", {
		style: "currency",
		currency: "EUR",
	}).format(n);
}

function renderTx(t: Transaction): string {
	const amountClass = t.type === "income" ? "income" : "expense";
	const dateFormatted = new Date(t.date).toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "short",
	});
	return `
    <div class="tx-item">
      <div class="tx-info">
        <span class="tx-icon">${t.icon}</span>
        <div class="tx-details">
          <div class="tx-desc">${escapeHtml(t.description)}</div>
          <div class="tx-meta">${escapeHtml(t.category_name)} · ${dateFormatted}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span class="tx-amount ${amountClass}">${t.type === "income" ? "+" : "-"}${formatMoney(t.amount)}</span>
        <button type="button" class="btn btn-danger" onclick="deleteTx(${t.id})">Suppr.</button>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
	const m: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
	return String(s).replace(/[&<>"]/g, (c) => m[c] ?? c);
}

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
