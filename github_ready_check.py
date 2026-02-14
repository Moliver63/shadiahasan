import os
import json
from pathlib import Path

ROOT = Path(".").resolve()

required_files = [
    "package.json",
]

recommended_files = [
    ".gitignore",
    "pnpm-lock.yaml",
    "vite.config.ts",
]

critical_gitignore_entries = [
    ".env",
    "node_modules",
    "dist"
]

def check_file_exists(filename):
    return (ROOT / filename).exists()

def check_git_initialized():
    return (ROOT / ".git").exists()

def check_gitignore_entries():
    gitignore_path = ROOT / ".gitignore"
    if not gitignore_path.exists():
        return False, []

    content = gitignore_path.read_text()
    missing = [entry for entry in critical_gitignore_entries if entry not in content]
    return len(missing) == 0, missing

def check_package_scripts():
    pkg_path = ROOT / "package.json"
    if not pkg_path.exists():
        return False, []

    try:
        data = json.loads(pkg_path.read_text())
        scripts = data.get("scripts", {})
        missing = []
        if "build" not in scripts:
            missing.append("build")
        if "start" not in scripts and "dev" not in scripts:
            missing.append("start/dev")
        return len(missing) == 0, missing
    except Exception:
        return False, ["Erro ao ler package.json"]

def main():
    print("\n🔎 VERIFICANDO PROJETO PARA GITHUB...\n")

    all_good = True

    # Required files
    print("📦 Arquivos obrigatórios:")
    for f in required_files:
        exists = check_file_exists(f)
        print(f"  {'✅' if exists else '❌'} {f}")
        if not exists:
            all_good = False

    print("\n📦 Arquivos recomendados:")
    for f in recommended_files:
        exists = check_file_exists(f)
        print(f"  {'✅' if exists else '⚠️'} {f}")

    # Git initialized
    git_init = check_git_initialized()
    print(f"\n🔧 Git inicializado: {'✅' if git_init else '❌'}")
    if not git_init:
        all_good = False

    # Gitignore
    gitignore_ok, missing_entries = check_gitignore_entries()
    print(f"\n🛡️ .gitignore protegido: {'✅' if gitignore_ok else '❌'}")
    if not gitignore_ok:
        print("   Faltando no .gitignore:", ", ".join(missing_entries))
        all_good = False

    # Package scripts
    scripts_ok, missing_scripts = check_package_scripts()
    print(f"\n⚙️ Scripts essenciais no package.json: {'✅' if scripts_ok else '❌'}")
    if not scripts_ok:
        print("   Scripts faltando:", ", ".join(missing_scripts))
        all_good = False

    # Env file warning
    if (ROOT / ".env").exists():
        print("\n⚠️ ATENÇÃO: .env existe na raiz.")
        print("   Verifique se ele está no .gitignore!")
    else:
        print("\n🔐 .env não encontrado (ok se estiver só no servidor).")

    print("\n" + "="*50)

    if all_good:
        print("🚀 PROJETO PRONTO PARA SUBIR NO GITHUB!")
    else:
        print("❌ Corrija os itens acima antes de subir.")

    print("="*50 + "\n")

if __name__ == "__main__":
    main()
