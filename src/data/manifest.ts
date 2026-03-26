export type DocBlock = {
	id: string;
	title: string;
	// The initial MVP keeps block body optional; later we can hydrate from DOCX->HTML.
	body?: string;
};

export type DocPreview =
	| {
			kind: "placeholder";
			thumbnailSrc: string;
			heroSrc: string;
	  }
	| {
			kind: "images";
			thumbnailSrc: string;
			heroSrc: string;
			pageCount: number;
			// Example: /assets/{docId}/page-0001.png
			pageSrc: (pageIndex1Based: number) => string;
	  };

export type DocEntry = {
	id: string;
	title: string;
	category: string;
	description?: string;
	preview: DocPreview;
	blocks: DocBlock[];
	download: {
		// These are served from /public when conversion is wired up.
		originalDocxHref?: string;
		previewZipHref?: string;
	};
};

function makeThumbSvg(label: string) {
	const safe = label.replace(/[<>&"]/g, "");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
		<defs>
			<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="#6366f1" stop-opacity=".25"/>
				<stop offset="1" stop-color="#ec4899" stop-opacity=".20"/>
			</linearGradient>
		</defs>
		<rect x="10" y="10" width="120" height="120" rx="28" fill="url(#g)" stroke="rgba(15,23,42,.10)"/>
		<text x="70" y="78" text-anchor="middle" font-family="ui-sans-serif,system-ui,-apple-system" font-size="16" fill="rgba(15,23,42,.85)" font-weight="800">${safe}</text>
	</svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const manifest: {
	siteTitle: string;
	docs: DocEntry[];
} = {
	siteTitle: "资料平台（MVP）",
	docs: [
		{
			id: "scholarship-review-notes",
			title: "奖学金审查注意事项",
			category: "助管应知应会",
			description: "审查流程要点与常见问题汇总。",
			preview: {
				kind: "placeholder",
				thumbnailSrc: makeThumbSvg("奖学金"),
				heroSrc: makeThumbSvg("奖学金审查"),
			},
			blocks: [
				{ id: "block-1", title: "这是什么：审查范围与要求", body: "（示例）这里会展示该资料的第 1 块内容。" },
				{ id: "block-2", title: "那是什么：材料准备清单", body: "（示例）这里会展示第 2 块内容。" },
				{ id: "block-3", title: "然后是：常见问题与注意事项", body: "（示例）这里会展示第 3 块内容。" },
			],
			download: {},
		},
		{
			id: "tuition-pay-flow",
			title: "交话费流程",
			category: "助管应知应会",
			description: "从申请到核对的完整办理步骤。",
			preview: {
				kind: "placeholder",
				thumbnailSrc: makeThumbSvg("话费"),
				heroSrc: makeThumbSvg("交话费"),
			},
			blocks: [
				{ id: "block-1", title: "这是什么：办理对象与入口", body: "（示例）" },
				{ id: "block-2", title: "那是什么：办理流程与时间点", body: "（示例）" },
				{ id: "block-3", title: "然后是：常见返工原因", body: "（示例）" },
			],
			download: {},
		},
		{
			id: "upper-doc-receive",
			title: "上级文件接收",
			category: "助管应知应会",
			description: "文件签收、登记与传阅要求。",
			preview: {
				kind: "placeholder",
				thumbnailSrc: makeThumbSvg("文件"),
				heroSrc: makeThumbSvg("接收文件"),
			},
			blocks: [
				{ id: "block-1", title: "这是什么：接收范围与责任", body: "（示例）" },
				{ id: "block-2", title: "那是什么：登记与传阅步骤", body: "（示例）" },
				{ id: "block-3", title: "然后是：归档与留痕要求", body: "（示例）" },
			],
			download: {},
		},
		{
			id: "review-question-template",
			title: "审查问题模板",
			category: "助管应知应会",
			description: "可直接套用的审查问题清单。",
			preview: {
				kind: "placeholder",
				thumbnailSrc: makeThumbSvg("模板"),
				heroSrc: makeThumbSvg("审查模板"),
			},
			blocks: [
				{ id: "block-1", title: "这是什么：模板适用场景", body: "（示例）" },
				{ id: "block-2", title: "那是什么：问题字段说明", body: "（示例）" },
				{ id: "block-3", title: "然后是：填写与校对要点", body: "（示例）" },
			],
			download: {},
		},
		{
			id: "file-scan-method",
			title: "文件扫描方法",
			category: "助管应知应会",
			description: "扫描参数、命名规范与质量检查。",
			preview: {
				kind: "placeholder",
				thumbnailSrc: makeThumbSvg("扫描"),
				heroSrc: makeThumbSvg("扫描方法"),
			},
			blocks: [
				{ id: "block-1", title: "这是什么：推荐扫描设置", body: "（示例）" },
				{ id: "block-2", title: "那是什么：文件命名规范", body: "（示例）" },
				{ id: "block-3", title: "然后是：成品验收标准", body: "（示例）" },
			],
			download: {},
		},
	],
};

export function getDocsByCategory() {
	const map = new Map<string, DocEntry[]>();
	for (const doc of manifest.docs) {
		const list = map.get(doc.category) ?? [];
		list.push(doc);
		map.set(doc.category, list);
	}
	return [...map.entries()].map(([category, docs]) => ({ category, docs }));
}

