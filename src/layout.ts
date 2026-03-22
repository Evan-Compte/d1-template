const NAV_HTML = (currentPath: string) => `
<nav class="nav">
  <a href="/" class="nav-link ${currentPath === "/" || currentPath === "/budget" ? "active" : ""}">📊 Budget</a>
  <a href="/stats" class="nav-link ${currentPath === "/stats" ? "active" : ""}">📈 Stats</a>
  <a href="/historique" class="nav-link ${currentPath === "/historique" ? "active" : ""}">📋 Historique</a>
  <a href="/categories" class="nav-link ${currentPath === "/categories" ? "active" : ""}">🏷️ Catégories</a>
  <a href="/parametres" class="nav-link ${currentPath === "/parametres" ? "active" : ""}">⚙️ Paramètres</a>
</nav>`;

const BASE_STYLES = `
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
body { font-family: 'DM Sans', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; line-height: 1.5; }
.container { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }
h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem; background: linear-gradient(135deg, var(--text) 0%, var(--text-muted) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.nav { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
.nav-link { color: var(--text-muted); text-decoration: none; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.9rem; transition: all 0.2s; }
.nav-link:hover { background: var(--surface-hover); color: var(--text); }
.nav-link.active { background: var(--accent-dim); color: white; }
.section { margin-bottom: 2rem; }
.section-title { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: var(--text-muted); }
.btn { padding: 0.7rem 1.25rem; border-radius: 8px; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; font-family: inherit; }
.btn-primary { background: var(--accent); color: white; }
.btn-primary:hover { background: var(--accent-dim); }
.btn-danger { background: #7f1d1d; color: #fca5a5; font-size: 0.75rem; padding: 0.4rem 0.7rem; }
.btn-danger:hover { background: #991b1b; }
.btn-sm { padding: 0.4rem 0.8rem; font-size: 0.8rem; }
input, select, textarea { width: 100%; padding: 0.6rem 0.85rem; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: inherit; font-size: 0.95rem; }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); }
label { font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 0.35rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 520px) { .form-row { grid-template-columns: 1fr; } }
.error { background: #7f1d1d; color: #fca5a5; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
.success { background: #14532d; color: #86efac; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
.empty { text-align: center; padding: 2rem; color: var(--text-muted); }
`;

const HEAD_HTML = `
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Mon Budget Personnel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
`;

export function layout(opts: {
	title: string;
	content: string;
	scripts?: string;
	currentPath: string;
	appName?: string;
}) {
	const title = opts.appName ? `${opts.appName} - ${opts.title}` : opts.title;
	return `<!DOCTYPE html>
<html lang="fr">
<head>
  ${HEAD_HTML}
  <title>${escapeHtml(title)}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(opts.appName || "Mon Budget Personnel")}</h1>
    ${NAV_HTML(opts.currentPath)}
    ${opts.content}
  </div>
  ${opts.scripts ? `<script>${opts.scripts}</script>` : ""}
</body>
</html>`;
}

export function escapeHtml(s: string): string {
	const m: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
	return String(s).replace(/[&<>"]/g, (c) => m[c] ?? c);
}

export function formatMoney(n: number, currency = "EUR"): string {
	return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(n);
}
