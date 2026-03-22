import { renderBudgetApp } from "./renderBudget";
import { renderStatsPage } from "./renderStats";
import { renderCategoriesPage } from "./renderCategories";
import { renderHistoryPage } from "./renderHistory";
import { renderSettingsPage } from "./renderSettings";

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
				return new Response(await renderBudgetApp(env, { error: "Données invalides" }), {
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

		// POST: Ajouter une catégorie
		if (request.method === "POST" && path === "/categories") {
			const formData = await request.formData();
			const name = (formData.get("name") as string)?.trim();
			const type = formData.get("type") as "income" | "expense";
			const icon = (formData.get("icon") as string) || "💰";
			const color = (formData.get("color") as string) || "#6366f1";

			if (!name) {
				return new Response(
					await renderCategoriesPage(env, { error: "Le nom est requis" }),
					{ headers: { "Content-Type": "text/html; charset=utf-8" } }
				);
			}

			try {
				await env.DB.prepare(
					"INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?)"
				)
					.bind(name, type, icon, color)
					.run();
				return Response.redirect(url.origin + "/categories?success=1");
			} catch {
				return new Response(
					await renderCategoriesPage(env, { error: "Cette catégorie existe déjà" }),
					{ headers: { "Content-Type": "text/html; charset=utf-8" } }
				);
			}
		}

		// POST: Supprimer une catégorie
		if (request.method === "POST" && path === "/categories/delete") {
			const formData = await request.formData();
			const id = parseInt(formData.get("id") as string);
			if (id) {
				const used = await env.DB.prepare(
					"SELECT COUNT(*) as c FROM transactions WHERE category_id = ?"
				)
					.bind(id)
					.first<{ c: number }>();
				if (used?.c === 0) {
					await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
					return Response.redirect(url.origin + "/categories?deleted=1");
				}
			}
			return new Response(
				await renderCategoriesPage(env, { error: "Impossible de supprimer : catégorie utilisée" }),
				{ headers: { "Content-Type": "text/html; charset=utf-8" } }
			);
		}

		// POST: Paramètres
		if (request.method === "POST" && path === "/parametres") {
			const formData = await request.formData();
			const currency = (formData.get("currency") as string) || "EUR";
			const appName = (formData.get("app_name") as string)?.trim() || "Mon Budget Personnel";

			await env.DB.prepare(
				"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
			)
				.bind("currency", currency)
				.run();
			await env.DB.prepare(
				"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
			)
				.bind("app_name", appName)
				.run();

			return Response.redirect(url.origin + "/parametres?success=1");
		}

		// GET: Page budget
		if (path === "/" || path === "/index.html" || path === "/budget") {
			const added = url.searchParams.get("added") === "1";
			return new Response(await renderBudgetApp(env, { added }), {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}

		// GET: Statistiques
		if (path === "/stats") {
			return new Response(await renderStatsPage(env), {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}

		// GET: Historique
		if (path === "/historique") {
			const from = url.searchParams.get("from") || undefined;
			const to = url.searchParams.get("to") || undefined;
			const category = url.searchParams.get("category") || undefined;
			const type = url.searchParams.get("type") || undefined;
			return new Response(
				await renderHistoryPage(env, { from, to, category, type }),
				{ headers: { "Content-Type": "text/html; charset=utf-8" } }
			);
		}

		// GET: Catégories
		if (path === "/categories") {
			const success = url.searchParams.get("success") === "1" ? "Catégorie ajoutée." : undefined;
			const deleted = url.searchParams.get("deleted") === "1" ? "Catégorie supprimée." : undefined;
			return new Response(
				await renderCategoriesPage(env, { success: success || deleted }),
				{ headers: { "Content-Type": "text/html; charset=utf-8" } }
			);
		}

		// GET: Paramètres
		if (path === "/parametres") {
			const success = url.searchParams.get("success") === "1" ? "Paramètres enregistrés." : undefined;
			return new Response(await renderSettingsPage(env, { success }), {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}

		return new Response("Not Found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
