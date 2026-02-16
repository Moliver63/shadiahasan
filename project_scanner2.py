import os
import re
from pathlib import Path

ROOT = Path(".").resolve()

IGNORE_DIRS = {
    "node_modules", ".git", "dist", "build", ".next", ".cache", ".turbo",
    ".vercel", ".output", "coverage", "tmp", "temp", ".pytest_cache"
}
IGNORE_FILES_SUFFIX = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".mp4", ".mov", ".log"}

TEXT_EXT = {".js", ".ts", ".tsx", ".jsx", ".json", ".env", ".mjs", ".cjs", ".yaml", ".yml", ".md"}

def should_ignore_dir(dir_name: str) -> bool:
    return dir_name in IGNORE_DIRS

def should_ignore_file(path: Path) -> bool:
    if path.suffix.lower() in IGNORE_FILES_SUFFIX:
        return True
    # ignora arquivos gigantes (ex: bundles) acima de 3MB
    try:
        if path.stat().st_size > 3 * 1024 * 1024:
            return True
    except:
        return True
    return False

def is_text_candidate(path: Path) -> bool:
    if path.suffix.lower() in TEXT_EXT:
        return True
    # permite ler arquivos sem extensão comuns
    if path.name in {"Dockerfile", "Procfile"}:
        return True
    return False

def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except:
        return ""

files = []
for root, dirs, fs in os.walk(ROOT):
    # filtra dirs ignoradas
    dirs[:] = [d for d in dirs if not should_ignore_dir(d)]
    for f in fs:
        p = Path(root) / f
        if should_ignore_file(p):
            continue
        if is_text_candidate(p):
            files.append(p)

print(f"\n📂 Arquivos de texto analisáveis (sem node_modules/dist/etc): {len(files)}\n")

# --- Encontrar package.json principais
pkg_files = [p for p in files if p.name == "package.json"]
print("📦 package.json encontrados:")
for p in pkg_files[:30]:
    print(" -", p.relative_to(ROOT))
if len(pkg_files) > 30:
    print(f" ... +{len(pkg_files)-30} outros")

def find_patterns(patterns, label):
    hits = []
    for p in files:
        txt = read_text(p)
        for pat in patterns:
            if re.search(pat, txt, flags=re.IGNORECASE):
                hits.append((p, pat))
                break
    if hits:
        print(f"\n✅ {label}: {len(hits)} arquivo(s)")
        for p, _ in hits[:25]:
            print(" -", p.relative_to(ROOT))
        if len(hits) > 25:
            print(f" ... +{len(hits)-25} outros")
    else:
        print(f"\n❌ {label}: nenhum encontrado")
    return hits

# --- Checks de AUTH/DEPLOY (os que mais quebram login no Render)
hits_trust_proxy = find_patterns(
    [r"app\.set\(\s*['\"]trust proxy['\"]\s*,\s*1\s*\)"],
    "Express trust proxy (necessário no Render p/ cookies/sessão)"
)

hits_cookie_secure = find_patterns(
    [r"sameSite\s*:\s*['\"]none['\"]", r"secure\s*:\s*true", r"cookie\s*:\s*\{"],
    "Config de cookie (secure/sameSite/httpOnly)"
)

hits_cors = find_patterns(
    [r"cors\(", r"Access-Control-Allow-Origin", r"origin\s*:"],
    "CORS configurado"
)

hits_jwt = find_patterns(
    [r"JWT_SECRET", r"jwt\.sign\(", r"jsonwebtoken", r"SESSION_SECRET"],
    "JWT/Session secret"
)

hits_dotenv = find_patterns(
    [r"dotenv", r"config\(\)"],
    "dotenv carregado"
)

hits_port = find_patterns(
    [r"process\.env\.PORT", r"listen\(\s*process\.env\.PORT", r"PORT\s*\|\|"],
    "Uso correto de PORT (Render exige process.env.PORT)"
)

hits_localhost = find_patterns(
    [r"localhost:3000", r"localhost:5173", r"http://localhost", r"https?://127\.0\.0\.1"],
    "URLs hardcoded de localhost (quebram em produção)"
)

hits_credentials_include = find_patterns(
    [r"credentials\s*:\s*['\"]include['\"]", r"withCredentials\s*:\s*true"],
    "Frontend enviando cookies (credentials/include ou axios withCredentials)"
)

# --- Sugestão de arquivos para ajustar (prioridade)
to_fix = []

if not hits_trust_proxy:
    to_fix.append("Adicionar app.set('trust proxy', 1) no arquivo principal do servidor (server.js/index.js).")

if not hits_port:
    to_fix.append("Garantir que o server usa process.env.PORT no listen().")

if not hits_jwt:
    to_fix.append("Verificar JWT_SECRET/SESSION_SECRET: se não existir, login pode falhar com 500/401.")

if hits_localhost:
    to_fix.append("Remover localhost hardcoded (API_URL) e usar variável de ambiente/URL relativa.")

if not hits_credentials_include:
    to_fix.append("No frontend: fetch/axios precisa enviar cookies (credentials:'include' ou withCredentials:true), se auth usa cookie.")

print("\n==============================")
print("🎯 AÇÕES RECOMENDADAS (prioridade):")
if to_fix:
    for i, item in enumerate(to_fix, 1):
        print(f"{i}. {item}")
else:
    print("Nenhuma ação óbvia detectada — precisamos olhar logs/erros específicos do login.")
print("==============================\n")

# --- Salvar relatório
report_path = ROOT / "RELATORIO_PROJETO_2.txt"
with open(report_path, "w", encoding="utf-8") as f:
    f.write(f"Arquivos analisados: {len(files)}\n\n")
    for line in [
        ("trust_proxy", hits_trust_proxy),
        ("cookie_secure_samesite", hits_cookie_secure),
        ("cors", hits_cors),
        ("jwt_session", hits_jwt),
        ("dotenv", hits_dotenv),
        ("port", hits_port),
        ("localhost", hits_localhost),
        ("credentials_include", hits_credentials_include),
    ]:
        name, hits = line
        f.write(f"\n## {name} ({len(hits)})\n")
        for p, pat in hits:
            f.write(f"- {p.relative_to(ROOT)} | {pat}\n")
    f.write("\n\nAÇÕES RECOMENDADAS:\n")
    for item in to_fix:
        f.write(f"- {item}\n")

print(f"📄 Relatório salvo em: {report_path.name}")
