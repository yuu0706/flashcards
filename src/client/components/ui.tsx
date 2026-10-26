import { useEffect, useRef, type ReactNode } from "react";

import { navigate } from "../lib/router";

export function Link({ to, className, children, ariaLabel }: { to: string; className?: string; children: ReactNode; ariaLabel?: string }) {
	return (
		<a
			href={to}
			className={className}
			aria-label={ariaLabel}
			onClick={(e) => {
				if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
				e.preventDefault();
				navigate(to);
			}}
		>
			{children}
		</a>
	);
}

/** Lucide の線のアイコン(必要な分だけ手で持つ。ライブラリを足さない) */
const PATHS = {
	plus: ["M5 12h14", "M12 5v14"],
	"arrow-left": ["m12 19-7-7 7-7", "M19 12H5"],
	upload: ["M12 3v12", "m17 8-5-5-5 5", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
	download: ["M12 15V3", "m7 10 5 5 5-5", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
	settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
	inbox: ["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"],
	check: ["M20 6 9 17l-5-5"],
	x: ["M18 6 6 18", "m6 6 12 12"],
	more: ["M12 12h.01", "M19 12h.01", "M5 12h.01"],
	flame: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
	trophy: ["M6 9H4.5a2.5 2.5 0 0 1 0-5H6", "M18 9h1.5a2.5 2.5 0 0 0 0-5H18", "M4 22h16", "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22", "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22", "M18 2H6v7a6 6 0 0 0 12 0V2z"],
	"book-open": ["M12 7v14", "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size }: { name: IconName; size?: "md" }) {
	return (
		<svg className={`icon ${size === "md" ? "icon--md" : ""}`} viewBox="0 0 24 24" aria-hidden="true">
			{PATHS[name].map((d) => (
				<path key={d} d={d} />
			))}
		</svg>
	);
}

export function Badge({ tone, children }: { tone: "success" | "warning" | "danger" | "accent" | "neutral"; children: ReactNode }) {
	return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function PageHeader({ crumb, title, badges, actions }: { crumb?: ReactNode; title: ReactNode; badges?: ReactNode; actions?: ReactNode }) {
	return (
		<header className="page-header">
			<div className="page-header__title">
				{crumb ? <nav className="breadcrumb" aria-label="パンくず">{crumb}</nav> : null}
				<h1>
					<span className="page-header__text">{title}</span>
					{badges}
				</h1>
			</div>
			{actions ? <div className="page-header__actions">{actions}</div> : null}
		</header>
	);
}

export function EmptyState({ icon, title, action }: { icon?: IconName; title: string; action?: ReactNode }) {
	return (
		<div className="state" data-state="empty">
			<Icon name={icon ?? "inbox"} size="md" />
			<p className="state__title">{title}</p>
			{action}
		</div>
	);
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
	return (
		<div className="state state--error" role="alert" data-state="error">
			<p className="state__title">{message}</p>
			{onRetry ? (
				<button className="btn btn--secondary" type="button" onClick={onRetry}>
					再読み込みする
				</button>
			) : null}
		</div>
	);
}

export function SkeletonRows({ cols, rows = 3 }: { cols: number; rows?: number }) {
	return (
		<tbody aria-busy="true">
			{Array.from({ length: rows }, (_, i) => (
				<tr key={i} className="skeleton-row">
					<td colSpan={cols}>
						<span className="skeleton" />
					</td>
				</tr>
			))}
		</tbody>
	);
}

export function InlineError({ message }: { message: string | null }) {
	if (!message) return null;
	return (
		<p className="inline-error" role="alert">
			{message}
		</p>
	);
}

/** 操作の近くに出す短い通知。数秒で消える */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
	useEffect(() => {
		if (!message) return;
		const t = setTimeout(onDone, 2500);
		return () => clearTimeout(t);
	}, [message, onDone]);
	if (!message) return null;
	return (
		<div className="toast" role="status">
			{message}
		</div>
	);
}

/** 取り消せない操作の確認。危険な側を既定の選択にしない */
export function ConfirmDialog({
	open,
	title,
	body,
	confirmLabel,
	onConfirm,
	onCancel,
}: {
	open: boolean;
	title: string;
	body: string;
	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (open && !el.open) el.showModal();
		if (!open && el.open) el.close();
	}, [open]);
	return (
		<dialog ref={ref} className="dialog" onClose={onCancel} aria-labelledby="confirm-title">
			<div className="dialog__body">
				<h2 id="confirm-title">{title}</h2>
				<p>{body}</p>
			</div>
			<div className="dialog__actions">
				<button className="btn btn--secondary" type="button" onClick={onCancel} autoFocus>
					キャンセル
				</button>
				<button className="btn btn--danger" type="button" onClick={onConfirm}>
					{confirmLabel}
				</button>
			</div>
		</dialog>
	);
}

export function StateBadge({ state, due, today }: { state: "new" | "learning" | "review"; due: string | null; today: string }) {
	if (state === "new") return <Badge tone="neutral">未学習</Badge>;
	if (state === "learning") return <Badge tone="danger">覚え直し</Badge>;
	if (due && due <= today) return <Badge tone="warning">今日</Badge>;
	return <Badge tone="success">復習中</Badge>;
}
