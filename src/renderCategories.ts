import { layout, escapeHtml } from "./layout";

interface Category {
	id: number;
	name: string;
	type: string;
	color: string;
	icon: string;
	_count?: number;
}

export async function renderCategoriesPage(
	env: Env,
	opts: { error?: string; success?: string }
): Promise<string> {
	const settings = await env.DB.prepare("SELECT key, value FROM settings").all();
	const settingsMap = Object.fromEntries(
		(settings.results as { key: string; value: string }[]).map((r) => [r.key, r.value])
	);
	const appName = settingsMap.app_name || "Mon Budget Personnel";

	const categories = await env.DB.prepare(
		`SELECT c.id, c.name, c.type, c.color, c.icon,
      (SELECT COUNT(*) FROM transactions WHERE category_id = c.id) as _count
     FROM categories c
     ORDER BY c.type, c.name`
	).all();

	const incomeCat = (categories.results as (Category & { _count: number })[]).filter(
		(c) => c.type === "income"
	);
	const expenseCat = (categories.results as (Category & { _count: number })[]).filter(
		(c) => c.type === "expense"
	);

	const icons = "💰 💼 💻 📈 🛒 🚗 🏠 🎬 ⚕️ 🏦 📦 🍔 ☕ 🎮 📱 ✈️ 🎁 📚";
	const colors = [
		"#22c55e", "#ef4444", "#f97316", "#8b5cf6", "#ec4899", "#06b6d4",
		"#14b8a6", "#64748b", "#eab308", "#84cc16",
	];

	return layout({
		title: "Catégories",
		appName,
		currentPath: "/categories",
		content: `
    ${opts.error ? `<div class="error">${escapeHtml(opts.error)}</div>` : ""}
    ${opts.success ? `<div class="success">${escapeHtml(opts.success)}</div>` : ""}

    <h2 class="section-title">Nouvelle catégorie</h2>
    <form method="post" action="/categories" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:2rem;display:grid;gap:1rem;">
      <div class="form-row">
        <div>
          <label>Nom</label>
          <input type="text" name="name" required placeholder="Ex: Restaurants" />
        </div>
        <div>
          <label>Type</label>
          <select name="type">
            <option value="expense">Dépense</option>
            <option value="income">Revenu</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>Icône</label>
          <select name="icon">
            ${icons.split(" ").map((i) => `<option value="${i}">${i}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Couleur</label>
          <select name="color">
            ${colors.map((c) => `<option value="${c}">${c}</option>`).join("")}
          </select>
        </div>
      </div>
      <button type="submit" class="btn btn-primary">Ajouter</button>
    </form>

    <h2 class="section-title">Catégories de revenus</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.75rem;margin-bottom:2rem;">
      ${incomeCat.map((c) => renderCatCard(c)).join("")}
    </div>

    <h2 class="section-title">Catégories de dépenses</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.75rem;">
      ${expenseCat.map((c) => renderCatCard(c)).join("")}
    </div>
  `,
	});
}

function renderCatCard(c: Category & { _count?: number }): string {
	const count = c._count ?? 0;
	const canDelete = count === 0;
	return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:1rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">
      <span style="font-size:1.5rem">${escapeHtml(c.icon)}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.name)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${count} transaction(s)</div>
      </div>
      <form method="post" action="/categories/delete" style="display:inline;" onsubmit="return confirm('Supprimer cette catégorie ?')">
        <input type="hidden" name="id" value="${c.id}" />
        <button type="submit" class="btn btn-danger btn-sm" ${!canDelete ? "disabled title='Catégorie utilisée'" : ""}>Suppr.</button>
      </form>
    </div>`;
}
