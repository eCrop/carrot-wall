-- The 5 course presets the instructor picks from on /admin (spec.md F6). Reference data, kept
-- separate from `prompts`: these rows are never themselves "active" and carry no activated_at,
-- so Prompt.active()'s `order by activated_at desc` never accidentally selects one.
CREATE TABLE prompt_presets (
    id   BIGSERIAL PRIMARY KEY,
    text VARCHAR(200) NOT NULL
);

INSERT INTO prompt_presets (text) VALUES
  ('A única coisa que quero desta semana é…'),
  ('Uma coisa que aprendi hoje · uma coisa que ficou confusa'),
  ('Como correu o dia? O que ajustamos amanhã?'),
  ('Perguntas para o fim do dia'),
  ('Perguntas da semana');
