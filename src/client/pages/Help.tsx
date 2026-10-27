import { useState } from "react";

import { Icon, Link, PageHeader } from "../components/ui";

/** 配布する静的ファイル(public/help/)。見本の TSV と、AI に札を作らせるためのスキル */
const SAMPLE_URL = "/help/sample.tsv";
const SKILL_URL = "/help/flashcards-tsv/SKILL.md";

const COLUMNS = [
	{ name: "表", what: "問い。用語、または問題文", required: "必須", limit: "2000 文字" },
	{ name: "裏", what: "答え。用語の説明、または正解", required: "必須", limit: "4000 文字" },
	{ name: "補足", what: "答えの根拠や覚え方。記述のヒントにも使います", required: "任意", limit: "4000 文字" },
	{ name: "タグ", what: "分野の名前。読点かカンマで区切ります", required: "任意", limit: "20 個、1 個 50 文字" },
	{ name: "選択肢", what: "四択の誤答。| で区切ります。3 個あれば足ります", required: "任意", limit: "5 個、1 個 500 文字" },
] as const;

const EXAMPLE = [
	"表\t裏\t補足\tタグ\t選択肢",
	"TCP\tコネクション型で、到達と順序を保証するトランスポート層のプロトコル\t第 4 層。UDP との対比で覚える\tネットワーク\t",
	"DNSSEC が提供するものはどれか。\tDNS 応答の完全性と出所の真正性\t署名で改ざんと偽装を検知する。応答の暗号化はしない\t文章問題,ネットワーク\tDNS 応答の機密性|DNS サーバーの可用性|ゾーン転送の高速化",
].join("\n");

/** スキルを入れずに AI へ頼むときの依頼文。形式の要点だけを含める */
const PROMPT = `次の範囲の学習用の札を、タブ区切り(TSV)で作ってください。
列は「表、裏、補足、タグ、選択肢」の順で、1 行目は見出し「表	裏	補足	タグ	選択肢」にします。
- 表は用語か問題文、裏は答え。どちらも必須です。
- 補足は答えの根拠や覚え方。タグは分野名で、カンマ区切り。
- 選択肢は四択の誤答で、| で区切って 3 個。用語の札では空にします。
- セルの中の改行は \\n の 2 文字で書き、タブと引用符は入れません。
- 用語の札の裏は、その説明だけでその用語に行き着く文にします(裏を見て表を答える出題があります)。
- 全体を 1 つのコードブロックで出し、行の間に説明を挟みません。

範囲: `;

export function HelpPage() {
	const [copied, setCopied] = useState(false);

	async function copyPrompt() {
		try {
			await navigator.clipboard.writeText(PROMPT);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			/* クリップボードが使えない環境。下の文を手で選んでもらう */
		}
	}

	return (
		<>
			<PageHeader crumb={<Link to="/">単語帳</Link>} title="TSV の形式" />
			<div className="page-body help">
				<section className="section">
					<h2>列の並び</h2>
					<p className="field__help">タブ区切りで 1 行に 1 枚です。スプレッドシートで作って、行をコピーして貼り付けられます。</p>
					<div className="table-wrap">
						<table className="table">
							<thead>
								<tr>
									<th>列</th>
									<th>内容</th>
									<th className="nowrap">必須</th>
									<th>上限</th>
								</tr>
							</thead>
							<tbody>
								{COLUMNS.map((c) => (
									<tr key={c.name}>
										<td className="nowrap">{c.name}</td>
										<td>{c.what}</td>
										<td className="nowrap">{c.required}</td>
										<td>{c.limit}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<ul className="help__list">
						<li>1 行目が「表、裏」で始まるときは見出しとして読み飛ばします。</li>
						<li>セルの中の改行は「\n」の 2 文字で書きます。セルの中にタブは入れられません。</li>
						<li>引用符（"）はそのまま文字として取り込みます。囲まないでください。</li>
						<li>表か裏が空の行は取り込みません。1 回の取り込みは 2000 行までです。</li>
						<li>選択肢が空の札は、同じ単語帳の他の札の裏から誤答を作ります。</li>
					</ul>
				</section>

				<section className="section">
					<h2>例</h2>
					<p className="field__help">1 行目が用語の札、2 行目が四択の文章問題です。タブは「→」で示しています。</p>
					<pre className="codeblock" aria-label="TSV の例">
						{EXAMPLE.replace(/\t/g, " → ")}
					</pre>
					<div className="row">
						<a className="btn btn--secondary" href={SAMPLE_URL} download="sample.tsv">
							<Icon name="download" />
							見本の TSV をダウンロード
						</a>
					</div>
				</section>

				<section className="section">
					<h2>AI に札を作らせる</h2>
					<p className="field__help">
						Claude などの AI に作らせるときは、形式を覚えさせるスキルを入れるか、下の依頼文を貼り付けてください。できた TSV は単語帳の「TSV から取り込む」に貼り付けます。
					</p>
					<div className="row">
						<a className="btn btn--secondary" href={SKILL_URL} download="SKILL.md">
							<Icon name="download" />
							Claude 用のスキルをダウンロード
						</a>
						<button className="btn btn--secondary" type="button" onClick={() => void copyPrompt()}>
							{copied ? "コピーしました" : "依頼文をコピー"}
						</button>
					</div>
					<ul className="help__list">
						<li>
							Claude Code では、ダウンロードした SKILL.md を <code>~/.claude/skills/flashcards-tsv/SKILL.md</code> に置くと、「単語帳の札を作って」で使われます。
						</li>
						<li>Claude.ai では、プロジェクトの知識か会話の添付として SKILL.md を渡してください。</li>
						<li>他の AI では、SKILL.md の本文か下の依頼文をそのまま貼り付けてください。</li>
					</ul>
					<pre className="codeblock" aria-label="依頼文">
						{PROMPT}
					</pre>
				</section>
			</div>
		</>
	);
}
