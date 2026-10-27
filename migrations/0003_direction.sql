-- 出題の向きを単語帳ごとに持つ。
--   forward: 表を見て裏を答える(従来どおり)
--   reverse: 裏(説明)を見て表(用語)を答える
--   mixed:   札ごとに無作為にどちらかを出す
-- 札の間隔反復の状態は向きに関係なく 1 つのまま
ALTER TABLE decks ADD COLUMN direction TEXT NOT NULL DEFAULT 'forward' CHECK (direction IN ('forward', 'reverse', 'mixed'));
