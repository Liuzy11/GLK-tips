import fs from "node:fs/promises";
import path from "node:path";

import type { DocEntry } from "./manifest";

export type JsonManifest = {
	siteTitle: string;
	docs: Array<
		Omit<DocEntry, "preview"> & {
			sourceRelPath?: string;
			preview: {
				thumbnailSrc?: string;
				heroSrc?: string;
				pageCount?: number;
			};
		}
	>;
};

export type BulletinConfig = {
	title: string;
	subtitle?: string;
	notices: Array<{ title: string; time: string }>;
	photos: Array<{ src: string; name: string }>;
};

const baseUrl = import.meta.env.BASE_URL ?? "/";

function withBase(href: string) {
	if (!href) return href;
	if (/^(https?:|data:|blob:|mailto:|tel:)/.test(href)) return href;
	const trimmed = href.replace(/^\/+/, "");
	return `${baseUrl}${trimmed}`;
}

export async function loadJsonManifest(): Promise<JsonManifest | null> {
	const filePath = path.join(process.cwd(), "content", "manifest.json");
	try {
		const raw = await fs.readFile(filePath, "utf8");
		return JSON.parse(raw) as JsonManifest;
	} catch {
		return null;
	}
}

export async function loadBulletinConfig(): Promise<BulletinConfig> {
	const filePath = path.join(process.cwd(), "content", "bulletin.json");
	try {
		const raw = await fs.readFile(filePath, "utf8");
		const parsed = JSON.parse(raw) as BulletinConfig;
		return {
			title: parsed.title || "公告墙 · 展览图",
			subtitle: parsed.subtitle || "可在这里发布通知，并持续补充现场照片。",
			notices: parsed.notices ?? [],
			photos: parsed.photos ?? [],
		};
	} catch {
		return {
			title: "公告墙 · 展览图",
			subtitle: "可在这里发布通知，并持续补充现场照片。",
			notices: [],
			photos: [],
		};
	}
}

function makeThumbSvg(label: string) {
	const safe = label.replace(/[<>&"]/g, "");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
		<defs>
			<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="#d9dde4" stop-opacity=".9"/>
				<stop offset="1" stop-color="#f4f6f8" stop-opacity=".95"/>
			</linearGradient>
		</defs>
		<rect x="10" y="10" width="120" height="120" rx="28" fill="url(#g)" stroke="rgba(16,24,40,.12)"/>
		<text x="70" y="78" text-anchor="middle" font-family="ui-sans-serif,system-ui,-apple-system" font-size="16" fill="rgba(16,24,40,.82)" font-weight="700">${safe}</text>
	</svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function loadManifestForSite() {
	const json = await loadJsonManifest();
	if (!json) {
		const mod = await import("./manifest");
		return { siteTitle: mod.manifest.siteTitle, docs: mod.manifest.docs };
	}

	const docs: DocEntry[] = json.docs.map((d) => {
		const short = d.title.slice(0, 2) || "资料";
		const thumb = d.preview.thumbnailSrc?.trim() || makeThumbSvg(short);
		const hero = d.preview.heroSrc?.trim() || thumb;
		const pageCount = d.preview.pageCount ?? 0;

		const sourceExt = d.sourceRelPath ? path.extname(d.sourceRelPath).toLowerCase() : ".docx";
		const fallbackOriginalHref = d.sourceRelPath ? withBase(`/downloads/raw/${d.id}${sourceExt || ".docx"}`) : "";
		const originalDocxHref = withBase(d.download?.originalDocxHref?.trim() || fallbackOriginalHref);
		const previewZipHref = withBase(d.download?.previewZipHref?.trim() || (pageCount > 0 ? `/downloads/${d.id}/pages.zip` : ""));

		return {
			...d,
			download: {
				originalDocxHref: originalDocxHref || undefined,
				previewZipHref: previewZipHref || undefined,
			},
			preview:
				pageCount > 0
					? {
							kind: "images",
							thumbnailSrc: withBase(thumb),
							heroSrc: withBase(hero),
							pageCount,
							pageSrc: (pageIndex1Based: number) =>
								withBase(`/assets/${d.id}/page-${String(pageIndex1Based).padStart(4, "0")}.png`),
					  }
					: {
							kind: "placeholder",
							thumbnailSrc: withBase(thumb),
							heroSrc: withBase(hero),
					  },
		};
	});

	return { siteTitle: json.siteTitle, docs };
}

export function groupDocsByCategory(docs: DocEntry[]) {
	const map = new Map<string, DocEntry[]>();
	for (const doc of docs) {
		const list = map.get(doc.category) ?? [];
		list.push(doc);
		map.set(doc.category, list);
	}
	return [...map.entries()].map(([category, docs]) => ({ category, docs }));
}
