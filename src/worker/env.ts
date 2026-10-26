import type { Env as HonoEnv } from "hono";

import type { Db } from "../db/client";

/** ログイン中の利用者。auth ミドルウェアが載せる */
export type Actor = { id: string; email: string };

export type AppEnv = {
	Bindings: Env;
	Variables: {
		actor?: Actor;
		db?: Db;
	};
};

type AssertHonoEnv<T extends HonoEnv> = T;
export type _AppEnvIsHonoEnv = AssertHonoEnv<AppEnv>;
