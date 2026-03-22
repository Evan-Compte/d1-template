// Convertit entre le format "knowledge graph" de l'interface Compte Evan et D1

export interface GraphNode {
	id: string;
	type: "category" | "transaction" | "budget";
	label: string;
	data?: {
		categoryType?: string;
		transactionType?: string;
		amount?: number;
		date?: string;
		description?: string;
	};
}

export interface GraphEdge {
	source: string;
	target: string;
	relation: string;
}

export interface Graph {
	nodes: GraphNode[];
	edges: GraphEdge[];
}

function rev2income(t: string): string {
	return t === "revenue" ? "income" : "expense";
}
function income2rev(t: string): string {
	return t === "income" ? "revenue" : "expense";
}

export async function d1ToGraph(env: Env): Promise<Graph> {
	const categories = await env.DB.prepare(
		"SELECT id, name, type FROM categories ORDER BY id"
	).all();
	const transactions = await env.DB.prepare(
		"SELECT id, amount, description, category_id, date, type FROM transactions ORDER BY id"
	).all();
	let budgetRows: { results: unknown[] } = { results: [] };
	try {
		budgetRows = await env.DB.prepare(
			"SELECT id, amount, description, category_id, date, type, applied_transaction_id FROM budget_entries ORDER BY id"
		).all();
	} catch {
		// Table budget_entries peut ne pas exister (migration 0004)
	}

	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];

	for (const c of categories.results as { id: number; name: string; type: string }[]) {
		nodes.push({
			id: "cat_" + c.id,
			type: "category",
			label: c.name,
			data: { categoryType: income2rev(c.type) },
		});
	}

	for (const t of transactions.results as {
		id: number;
		amount: number;
		description: string;
		category_id: number;
		date: string;
		type: string;
	}[]) {
		nodes.push({
			id: "tx_" + t.id,
			type: "transaction",
			label: t.description || t.type + " " + t.amount + "€",
			data: {
				amount: t.amount,
				date: t.date,
				description: t.description,
				transactionType: income2rev(t.type),
			},
		});
		edges.push({ source: "tx_" + t.id, target: "cat_" + t.category_id, relation: "belongs_to" });
	}

	for (const b of (budgetRows.results || []) as {
		id: number;
		amount: number;
		description: string;
		category_id: number;
		date: string;
		type: string;
		applied_transaction_id: number | null;
	}[]) {
		nodes.push({
			id: "budget_" + b.id,
			type: "budget",
			label: b.description || b.type + " " + b.amount + "€",
			data: {
				amount: b.amount,
				date: b.date,
				description: b.description || "",
				transactionType: income2rev(b.type),
			},
		});
		edges.push({ source: "budget_" + b.id, target: "cat_" + b.category_id, relation: "belongs_to" });
		if (b.applied_transaction_id) {
			edges.push({
				source: "budget_" + b.id,
				target: "tx_" + b.applied_transaction_id,
				relation: "applied_as",
			});
		}
	}

	return { nodes, edges };
}

export async function graphToD1(env: Env, graph: Graph): Promise<void> {
	// On recrée tout depuis le graphe (stratégie simple)
	const catNodes = (graph.nodes || []).filter((n) => n.type === "category");
	const txNodes = (graph.nodes || []).filter((n) => n.type === "transaction");
	const budgetNodes = (graph.nodes || []).filter((n) => n.type === "budget");
	const edges = graph.edges || [];

	// Mapping des anciens ids vers les nouveaux
	const catIdMap: Record<string, number> = {};
	const txIdMap: Record<string, number> = {};

	// 1. Vider et recréer les catégories (en préservant l'ordre si possible)
	try {
		await env.DB.prepare("DELETE FROM budget_entries").run();
	} catch {
		// Table peut ne pas exister
	}
	await env.DB.prepare("DELETE FROM transactions").run();
	await env.DB.prepare("DELETE FROM categories").run();

	for (const n of catNodes) {
		const type = rev2income(n.data?.categoryType || "expense");
		const result = await env.DB.prepare(
			"INSERT INTO categories (name, type) VALUES (?, ?)"
		)
			.bind(n.label || "Sans nom", type)
			.run();
		const newId = result.meta.last_row_id;
		if (newId) catIdMap[n.id] = newId as number;
	}

	// 2. Insérer les transactions
	for (const n of txNodes) {
		const edge = edges.find((e) => e.source === n.id && e.relation === "belongs_to");
		const catId = edge ? catIdMap[edge.target] : null;
		if (!catId) continue;

		const amount = n.data?.amount ?? 0;
		const date = n.data?.date ?? new Date().toISOString().slice(0, 10);
		const type = rev2income(n.data?.transactionType || "expense");
		const desc = n.data?.description ?? n.label ?? "";

		const result = await env.DB.prepare(
			"INSERT INTO transactions (amount, description, category_id, date, type) VALUES (?, ?, ?, ?, ?)"
		)
			.bind(amount, desc, catId, date, type)
			.run();
		const newId = result.meta.last_row_id;
		if (newId) txIdMap[n.id] = newId as number;
	}

	// 3. Insérer les entrées budget (si la table existe)
	try {
	for (const n of budgetNodes) {
		const catEdge = edges.find((e) => e.source === n.id && e.relation === "belongs_to");
		const applyEdge = edges.find((e) => e.source === n.id && e.relation === "applied_as");
		const catId = catEdge ? catIdMap[catEdge.target] : null;
		if (!catId) continue;

		const amount = n.data?.amount ?? 0;
		const date = n.data?.date ?? new Date().toISOString().slice(0, 10);
		const type = rev2income(n.data?.transactionType || "expense");
		const desc = n.data?.description ?? n.label ?? "";
		const appliedTxId = applyEdge && txIdMap[applyEdge.target] ? txIdMap[applyEdge.target] : null;

		await env.DB.prepare(
			"INSERT INTO budget_entries (amount, description, category_id, date, type, applied_transaction_id) VALUES (?, ?, ?, ?, ?, ?)"
		)
			.bind(amount, desc, catId, date, type, appliedTxId)
			.run();
	}
	} catch {
		// Table budget_entries peut ne pas exister
	}
}
