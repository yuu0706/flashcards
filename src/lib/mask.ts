/**
 * 画面に出すメールアドレスを伏せる(肩越しに覗かれたときに読み取れないようにする)。
 * ローカル部とドメインはそれぞれ先頭の 1 文字だけ残し、末尾の TLD はそのまま出す。
 *   yamada@example.com → y***@e***.com
 * 形がメールアドレスでなければ、先頭 1 文字だけ残して伏せる
 */
export function maskEmail(email: string): string {
	const at = email.indexOf("@");
	if (at <= 0) return mask(email);
	const local = email.slice(0, at);
	const domain = email.slice(at + 1);
	const dot = domain.lastIndexOf(".");
	const host = dot > 0 ? domain.slice(0, dot) : domain;
	const tld = dot > 0 ? domain.slice(dot) : "";
	return `${mask(local)}@${mask(host)}${tld}`;
}

function mask(s: string): string {
	const first = [...s][0] ?? "";
	return `${first}***`;
}
