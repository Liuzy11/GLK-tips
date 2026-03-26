import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const importRoot = path.join(repoRoot, "content", "_imports", "02-管理科规范材料");
const sourceRoot = path.join(repoRoot, "content", "source");
const manifestPath = path.join(repoRoot, "content", "manifest.json");

function normRel(p) {
	return p.split(path.sep).join("/");
}

function stableIdFromRel(rel) {
	const h = crypto.createHash("sha1").update(rel).digest("hex").slice(0, 12);
	return `doc-${h}`;
}

function pickCategory(relParts) {
	// Try to select a meaningful folder like "4_助管应知应会"
	const hit =
		relParts.find((p) => /^\d+_/.test(p)) ??
		relParts[0] ??
		"未分类";
	return hit;
}

function titleFromFilename(filename) {
	return filename.replace(/\.(docx|doc)$/i, "");
}

async function* walk(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const e of entries) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) {
			yield* walk(full);
		} else if (e.isFile()) {
			yield full;
		}
	}
}

async function ensureDir(p) {
	await fs.mkdir(p, { recursive: true });
}

async function main() {
	await ensureDir(sourceRoot);

	const files = [];
	for await (const full of walk(importRoot)) {
		const ext = path.extname(full).toLowerCase();
		if (ext !== ".docx" && ext !== ".doc") continue;
		files.push(full);
	}

	const docs = [];
	for (const full of files) {
		const relFromImport = path.relative(importRoot, full);
		const relNorm = normRel(relFromImport);
		const relParts = relNorm.split("/").filter(Boolean);
		const filename = relParts[relParts.length - 1] ?? path.basename(full);
		const category = pickCategory(relParts.slice(0, -1));

		const id = stableIdFromRel(relNorm);
		const title = titleFromFilename(filename);

		// Copy original into content/source keeping folder structure
		const dest = path.join(sourceRoot, relFromImport);
		await ensureDir(path.dirname(dest));
		await fs.copyFile(full, dest);

		docs.push({
			id,
			title,
			category,
			description: "",
			sourceRelPath: normRel(path.relative(repoRoot, dest)),
			preview: {
				thumbnailSrc: "",
				heroSrc: "",
				pageCount: 0
			},
			blocks: [
				{ id: "block-1", title: "（待提取）标题 1" },
				{ id: "block-2", title: "（待提取）标题 2" },
				{ id: "block-3", title: "（待提取）标题 3" }
			],
			download: {
				originalDocxHref: "",
				previewZipHref: ""
			}
		});
	}

	docs.sort((a, b) => (a.category + a.title).localeCompare(b.category + b.title, "zh"));

	const manifest = {
		siteTitle: "资料平台",
		docs
	};

	await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
	console.log(`wrote ${manifestPath}`);
	console.log(`docs=${docs.length}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

