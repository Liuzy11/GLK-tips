import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mammoth from "mammoth";

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, "content", "manifest.json");

function normRel(p) {
	return p.split(path.sep).join("/");
}

function stableBlockId(title, index) {
	const h = crypto.createHash("sha1").update(`${title}:${index}`).digest("hex").slice(0, 8);
	return `b-${h}`;
}

function uniqKeepOrder(arr) {
	const seen = new Set();
	const out = [];
	for (const x of arr) {
		const k = String(x).trim();
		if (!k) continue;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(k);
	}
	return out;
}

function titleFromFilename(filename) {
	return filename.replace(/\.(docx|doc)$/i, "");
}

async function extractHeadingsFromDocx(absPath) {
	const { value: html } = await mammoth.convertToHtml({ path: absPath });
	// Mammoth typically emits <h1>, <h2>, <h3> for Word headings if styles map.
	const matches = [...html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g)].map((m) =>
		m[1]
			.replace(/<[^>]+>/g, "")
			.replace(/&nbsp;/g, " ")
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.trim()
	);
	return uniqKeepOrder(matches);
}

async function main() {
	const raw = await fs.readFile(manifestPath, "utf8");
	const manifest = JSON.parse(raw);

	for (const doc of manifest.docs ?? []) {
		const sourceRel = doc.sourceRelPath;
		if (!sourceRel) continue;
		const abs = path.join(repoRoot, sourceRel);
		const ext = path.extname(abs).toLowerCase();

		let headings = [];
		if (ext === ".docx") {
			try {
				headings = await extractHeadingsFromDocx(abs);
			} catch {
				headings = [];
			}
		}

		const fallbackTitle = titleFromFilename(path.basename(abs));
		const picked = (headings.length ? headings : [fallbackTitle, "办理流程", "注意事项"]).slice(0, 5);

		doc.blocks = picked.map((t, idx) => ({
			id: stableBlockId(t, idx),
			title: t
		}));

		// Keep preview/download fields to be filled by CI later.
		doc.preview = doc.preview ?? { thumbnailSrc: "", heroSrc: "", pageCount: 0 };
		doc.download = doc.download ?? { originalDocxHref: "", previewZipHref: "" };

		// Ensure category/title are strings (defensive)
		doc.title = String(doc.title ?? fallbackTitle);
		doc.category = String(doc.category ?? "未分类");
		doc.sourceRelPath = normRel(sourceRel);
	}

	await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
	console.log(`updated blocks in ${manifestPath}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

