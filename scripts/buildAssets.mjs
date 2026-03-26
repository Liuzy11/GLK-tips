import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, "content", "manifest.json");
const outAssetsRoot = path.join(repoRoot, "public", "assets");
const outDownloadsRoot = path.join(repoRoot, "public", "downloads");

function run(cmd, args, opts = {}) {
	return new Promise((resolve, reject) => {
		const p = spawn(cmd, args, { stdio: "inherit", ...opts });
		p.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${cmd} ${args.join(" ")} failed with code ${code}`));
		});
	});
}

async function ensureDir(p) {
	await fs.mkdir(p, { recursive: true });
}

async function fileExists(p) {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

async function countPages(dir) {
	const items = await fs.readdir(dir);
	return items.filter((x) => /^page-\d{4}\.png$/.test(x)).length;
}

async function main() {
	const raw = await fs.readFile(manifestPath, "utf8");
	const manifest = JSON.parse(raw);

	for (const doc of manifest.docs ?? []) {
		if (!doc.id || !doc.sourceRelPath) continue;

		const srcAbs = path.join(repoRoot, doc.sourceRelPath);
		if (!(await fileExists(srcAbs))) {
			console.warn(`missing source file: ${srcAbs}`);
			continue;
		}

		const docAssetsDir = path.join(outAssetsRoot, doc.id);
		const docDownloadsDir = path.join(outDownloadsRoot, doc.id);
		await ensureDir(docAssetsDir);
		await ensureDir(docDownloadsDir);

		// Copy original
		const ext = path.extname(srcAbs).toLowerCase();
		const originalName = ext === ".doc" ? "original.doc" : "original.docx";
		const originalOut = path.join(docDownloadsDir, originalName);
		await fs.copyFile(srcAbs, originalOut);

		// Convert to PDF via LibreOffice
		const tmpDir = path.join(repoRoot, ".tmp", "convert", doc.id);
		await ensureDir(tmpDir);

		await run("soffice", [
			"--headless",
			"--nologo",
			"--nofirststartwizard",
			"--convert-to",
			"pdf",
			"--outdir",
			tmpDir,
			srcAbs
		]);

		// Find the produced PDF in tmpDir
		const tmpFiles = await fs.readdir(tmpDir);
		const pdf = tmpFiles.find((f) => f.toLowerCase().endsWith(".pdf"));
		if (!pdf) throw new Error(`no pdf produced for ${doc.id}`);
		const pdfAbs = path.join(tmpDir, pdf);

		// PDF -> PNG pages (page-0001.png, ...)
		const pagePrefix = path.join(docAssetsDir, "page");
		await run("pdftoppm", ["-png", "-r", "150", pdfAbs, pagePrefix]);

		// pdftoppm outputs page-1.png etc by default; rename to page-0001.png
		const produced = (await fs.readdir(docAssetsDir)).filter((f) => /^page-\d+\.png$/.test(f));
		for (const f of produced) {
			const m = f.match(/^page-(\d+)\.png$/);
			if (!m) continue;
			const n = Number(m[1]);
			const target = `page-${String(n).padStart(4, "0")}.png`;
			await fs.rename(path.join(docAssetsDir, f), path.join(docAssetsDir, target));
		}

		// Set preview images from first page
		const firstPage = path.posix.join("assets", doc.id, "page-0001.png");
		doc.preview = doc.preview ?? {};
		doc.preview.thumbnailSrc = firstPage;
		doc.preview.heroSrc = firstPage;
		doc.preview.pageCount = await countPages(docAssetsDir);

		// Zip pages for download
		const zipOut = path.join(docDownloadsDir, "pages.zip");
		// Use zip command available on ubuntu-latest
		const cwd = docAssetsDir;
		// Zip all page-*.png
		await run("zip", ["-q", "-r", zipOut, "."], { cwd });

		doc.download = doc.download ?? {};
		doc.download.originalDocxHref = path.posix.join("downloads", doc.id, originalName);
		doc.download.previewZipHref = path.posix.join("downloads", doc.id, "pages.zip");
	}

	await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
	console.log("assets built and manifest updated");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

