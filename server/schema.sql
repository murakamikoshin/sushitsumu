-- すし積む 番付テーブル。一人一行なので、遊ばれても行数は人数までしか増えない。
CREATE TABLE IF NOT EXISTS scores (
  id        TEXT PRIMARY KEY,          -- 端末が作る匿名の識別子
  name      TEXT NOT NULL,
  day       TEXT NOT NULL,             -- その人が最後に遊んだ日（日本時間）
  best      INTEGER NOT NULL DEFAULT 0,  -- お任せ・総合
  bestO     INTEGER NOT NULL DEFAULT 0,  -- お品書き・総合
  dayBest   INTEGER NOT NULL DEFAULT 0,  -- お任せ・その日
  dayBestO  INTEGER NOT NULL DEFAULT 0,  -- お品書き・その日
  updatedAt TEXT NOT NULL
);

-- 総合は素直に降順。日別は「その日の行」だけを見たいので day を先頭に置く。
CREATE INDEX IF NOT EXISTS idx_best     ON scores (best DESC);
CREATE INDEX IF NOT EXISTS idx_bestO    ON scores (bestO DESC);
CREATE INDEX IF NOT EXISTS idx_dayBest  ON scores (day, dayBest DESC);
CREATE INDEX IF NOT EXISTS idx_dayBestO ON scores (day, dayBestO DESC);
