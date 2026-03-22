import { layout, escapeHtml } from "./layout";

const CURRENCIES = ["EUR", "USD", "CHF", "GBP", "CAD"];

export async function renderSettingsPage(
	env: Env,
	opts: { error?: string; success?: string }
): Promise<string> {
	const settings = await env.DB.prepare("SELECT key, value FROM settings").all();
	const map = Object.fromEntries(
		(settings.results as { key: string; value: string }[]).map((r) => [r.key, r.value])
	);
	const currency = map.currency || "EUR";
	const appName = map.app_name || "Mon Budget Personnel";

	return layout({
		title: "Paramètres",
		appName,
		currentPath: "/parametres",
		content: `
    ${opts.error ? `<div class="error">${escapeHtml(opts.error)}</div>` : ""}
    ${opts.success ? `<div class="success">${escapeHtml(opts.success)}</div>` : ""}

    <h2 class="section-title">Paramètres</h2>
    <form method="post" action="/parametres" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.5rem;max-width:400px;">
      <div style="margin-bottom:1rem;">
        <label>Nom de l'application</label>
        <input type="text" name="app_name" value="${escapeHtml(appName)}" placeholder="Mon Budget Personnel" />
      </div>
      <div style="margin-bottom:1.5rem;">
        <label>Devise</label>
        <select name="currency">
          ${CURRENCIES.map((c) => `<option value="${c}" ${currency === c ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Enregistrer</button>
    </form>
  `,
	});
}
