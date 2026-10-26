/** 開閉の状態は <html> の data 属性の1か所に集める。各部品はこれを読むだけにする */
const KEYS = ["panel"] as const;
type Key = (typeof KEYS)[number];

export function setUi(key: Key, value: "open" | "closed") {
	document.documentElement.dataset[key] = value;
}
