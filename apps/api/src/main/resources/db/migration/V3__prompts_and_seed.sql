-- The prompt of the moment. Exactly one is active: the most recently activated row.
CREATE TABLE prompts (
    id           BIGSERIAL PRIMARY KEY,
    text         VARCHAR(200) NOT NULL,
    activated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO prompts (text) VALUES ('A única coisa que quero desta semana é…');

-- Demo posts so a fresh clone shows a real wall on first load.
INSERT INTO posts (name, message, type, created_at) VALUES
  ('Rita',   'Quero aprender a usar o Claude Code sem ter de rever cada linha que ele escreve.', 'quero-aprender', CURRENT_TIMESTAMP - INTERVAL '95' MINUTE),
  ('Miguel', 'Quero perceber quando vale a pena parar e escrever uma spec em vez de ir logo ao código.', 'quero-aprender', CURRENT_TIMESTAMP - INTERVAL '88' MINUTE),
  (NULL,     'Como é que isto lida com um repositório de 400 mil linhas que ninguém já entende?', 'pergunta', CURRENT_TIMESTAMP - INTERVAL '74' MINUTE),
  ('Joana',  'Dá para correr os testes automaticamente sempre que ele mexe num ficheiro?', 'pergunta', CURRENT_TIMESTAMP - INTERVAL '61' MINUTE),
  ('André',  'Passo mais tempo a explicar o contexto do que a escrever o código eu próprio.', 'frustração', CURRENT_TIMESTAMP - INTERVAL '52' MINUTE),
  (NULL,     'Inventa nomes de métodos que não existem e diz que está tudo a passar.', 'frustração', CURRENT_TIMESTAMP - INTERVAL '47' MINUTE),
  ('Sofia',  'O café da máquina do terceiro andar é um crime contra a humanidade.', 'livre', CURRENT_TIMESTAMP - INTERVAL '33' MINUTE),
  ('Tiago',  'Quero aprender a montar isto para a equipa toda, não só para mim.', 'quero-aprender', CURRENT_TIMESTAMP - INTERVAL '25' MINUTE),
  (NULL,     'Isto funciona com Quarkus e Angular ou é só para quem faz Python?', 'pergunta', CURRENT_TIMESTAMP - INTERVAL '18' MINUTE),
  ('Carla',  'Boa semana a todos. Vim com pouca fé e muita curiosidade.', 'livre', CURRENT_TIMESTAMP - INTERVAL '9' MINUTE),
  ('Nuno',   'Quero sair daqui com um CLAUDE.md que não seja lixo.', 'quero-aprender', CURRENT_TIMESTAMP - INTERVAL '4' MINUTE);

-- One pinned, one already answered: the wall is never demoed empty of its own features.
UPDATE posts SET pinned = TRUE
  WHERE message LIKE 'Boa semana a todos%';

UPDATE posts SET answer_text = 'Sim — Dia 3 é exatamente isso: hooks que correm os testes por ti e recusam o que não passa.',
                 answer_updated_at = CURRENT_TIMESTAMP
  WHERE message LIKE 'Dá para correr os testes%';
