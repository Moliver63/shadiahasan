ENV SCANNER V2 (Shadia Hasan)

O que faz:
- Varre o projeto e encontra TODAS as variáveis de ambiente usadas:
  - process.env.X / process.env["X"]
  - import.meta.env.VITE_*
- Gera:
  - env-report.json (detalhado, com arquivos/linhas)
  - env-report.txt (legível)
  - .env.example (comentado)
  - .env.production.sample (sem comentários)

Como usar:
1) Coloque este arquivo na RAIZ do seu projeto (onde está package.json).
2) Rode:
   python env_scanner_v2.py

Dica:
- Variáveis VITE_* entram no build do frontend.
  Se mudar VITE_*, rode novamente: pnpm run build
