import { layout, escapeHtml, formatMoney } from "./layout";

export async function renderStatsPage(env: Env): Promise<string> {
	const settings = await env.DB.prepare("SELECT key, value FROM settings").all();
	const map = Object.fromEntries(
		(settings.results as { key: string; value: string }[]).map((r) => [r.key, r.value])
	);
	const currency = map.currency || "EUR";
	const appName = map.app_name || "Mon Budget Personnel";
	const byCategory = await env.DB.prepare(
		`SELECT c.name, c.icon, c.color, SUM(t.amount) as total
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.type = 'expense' AND t.date >= date('now', 'start of month')
     GROUP BY c.id
     ORDER BY total DESC`
	).all();

	const monthlyData = await env.DB.prepare(
		`SELECT strftime('%Y-%m', date) as month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as balance,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
     FROM transactions
     WHERE date >= date('now', '-6 months')
     GROUP BY month
     ORDER BY month ASC`
	).all();

	const expenseTotal =
		(byCategory.results as { total: number }[]).reduce((s, r) => s + r.total, 0) || 1;

	const chartData = (byCategory.results as { name: string; icon: string; color: string; total: number }[]).map(
		(r) => ({
			label: `${r.icon} ${r.name}`,
			value: r.total,
			percent: Math.round((r.total / expenseTotal) * 100),
			color: r.color,
		})
	);

	const monthlyLabels = (monthlyData.results as { month: string }[]).map((r) => r.month);
	const monthlyBalances = (monthlyData.results as { balance: number }[]).map((r) => r.balance);

	return layout({
		title: "Statistiques",
		appName,
		currentPath: "/stats",
		content: `
    <h2 class="section-title">Répartition des dépenses (ce mois)</h2>
    <div class="chart-container" style="margin-bottom:2rem;">
      <canvas id="pieChart" width="400" height="300"></canvas>
    </div>
    ${chartData.length === 0 ? '<p class="empty">Aucune dépense ce mois-ci.</p>' : ""}
    <div class="bar-legend" style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:2rem;">
      ${chartData
				.map(
					(d) => `
        <div style="display:flex;align-items:center;gap:1rem;">
          <span style="width:12px;height:12px;border-radius:3px;background:${escapeHtml(d.color)}"></span>
          <span style="flex:1">${escapeHtml(d.label)}</span>
          <span style="font-family:JetBrains Mono;font-weight:500">${formatMoney(d.value, currency)} (${d.percent}%)</span>
        </div>`
				)
				.join("")}
    </div>

    <h2 class="section-title">Évolution du solde (6 derniers mois)</h2>
    <div class="chart-container">
      <canvas id="lineChart" width="400" height="250"></canvas>
    </div>
  `,
		scripts: `
    const pieData = ${JSON.stringify(chartData)};
    const monthlyLabels = ${JSON.stringify(monthlyLabels)};
    const monthlyBalances = ${JSON.stringify(monthlyBalances)};

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4';
    script.onload = () => {
      if (pieData.length > 0) {
      new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: {
          labels: pieData.map(d => d.label),
          datasets: [{
            data: pieData.map(d => d.value),
            backgroundColor: pieData.map(d => d.color),
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } }
        }
      });
      }
      new Chart(document.getElementById('lineChart'), {
        type: 'line',
        data: {
          labels: monthlyLabels.map(m => m.slice(0,7)),
          datasets: [{
            label: 'Solde',
            data: monthlyBalances,
            borderColor: '#a78bfa',
            backgroundColor: 'rgba(167,139,250,0.1)',
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: '#2a2a32' }, ticks: { color: '#71717a' } },
            x: { grid: { color: '#2a2a32' }, ticks: { color: '#71717a' } }
          }
        }
      });
    };
    document.head.appendChild(script);
  `,
	});
}
