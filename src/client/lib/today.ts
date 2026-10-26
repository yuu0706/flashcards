/** 利用者の現地日付(YYYY-MM-DD)。サーバは日付の判断をしないので、クライアントが渡す */
export function today(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}
