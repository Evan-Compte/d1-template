import { renderBudgetApp } from "./renderBudget";

export default {
	async fetch(request: Request, env: Env) {
		const url = new URL(request.url);
		const path = url.pathname;

		// API: Supprimer une transaction
		if (request.method === "DELETE" && path.startsWith("/api/transactions/")) {
			const id = path.split("/").pop();
			if (id) {
				await env.DB.prepare("DELETE FROM transactions WHERE id = ?").bind(id).run();
				return new Response(JSON.stringify({ success: true }), {
					headers: { "Content-Type": "application/json" },
				});
			}
		}

		// POST: Ajouter une transaction
		if (request.method === "POST" && path === "/transactions") {
			const formData = await request.formData();
			const amount = parseFloat(formData.get("amount") as string);
			const description = (formData.get("description") as string)?.trim() || "Sans description";
			const categoryId = parseInt(formData.get("category") as string);
			const type = formData.get("type") as "income" | "expense";

			if (isNaN(amount) || !categoryId || !type) {
				return new Response(renderBudgetApp(env, { error: "Données invalides" }), {
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			}

			const date = (formData.get("date") as string) || new Date().toISOString().slice(0, 10);
			await env.DB.prepare(
				"INSERT INTO transactions (amount, description, category_id, date, type) VALUES (?, ?, ?, ?, ?)"
			)
				.bind(Math.abs(amount), description, categoryId, date, type)
				.run();

			return Response.redirect(url.origin + "/?added=1");
		}

		// GET: Page principale
		if (path === "/" || path === "/index.html") {
			const added = url.searchParams.get("added") === "1";
			return new Response(await renderBudgetApp(env, { added }), {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}

		return new Response("Not Found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
