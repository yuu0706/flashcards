-- 出題の形式(記述 / 四択)を単語帳ごとに持ち、札には自前の誤答の選択肢を持てるようにする。
-- 四択の誤答は、選択肢が無い札では同じ単語帳の他の札の裏から画面側で作る。
ALTER TABLE decks ADD COLUMN mode TEXT NOT NULL DEFAULT 'recall' CHECK (mode IN ('recall', 'choice'));
-- 誤答の選択肢は JSON の文字列配列(タグと同じ扱い)
ALTER TABLE cards ADD COLUMN choices TEXT NOT NULL DEFAULT '[]';
