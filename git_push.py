import subprocess
import sys
from datetime import datetime


def run(cmd: list[str]) -> tuple[int, str, str]:
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def git_push(mensagem: str = "", arquivos: list[str] | None = None):
    print("=" * 50)
    print("  GitHub Auto Push")
    print("=" * 50)

    # 1. Status
    code, out, _ = run(["git", "status", "--short"])
    if not out:
        print("\n✅ Nenhuma alteração para enviar.")
        return
    print(f"\n📋 Arquivos modificados:\n{out}\n")

    # 2. Add
    if arquivos:
        for f in arquivos:
            code, _, err = run(["git", "add", f])
            if code != 0:
                print(f"❌ Erro ao adicionar '{f}': {err}")
                sys.exit(1)
        print(f"✅ Adicionados: {', '.join(arquivos)}")
    else:
        code, _, err = run(["git", "add", "."])
        if code != 0:
            print(f"❌ Erro no git add: {err}")
            sys.exit(1)
        print("✅ Todos os arquivos adicionados.")

    # 3. Commit
    if not mensagem:
        mensagem = f"update: {datetime.now().strftime('%d/%m/%Y %H:%M')}"

    code, out, err = run(["git", "commit", "-m", mensagem])
    if code != 0:
        if "nothing to commit" in err or "nothing to commit" in out:
            print("✅ Nada novo para commitar.")
            return
        print(f"❌ Erro no commit: {err}")
        sys.exit(1)
    print(f"✅ Commit: \"{mensagem}\"")

    # 4. Push
    print("⬆️  Enviando para o GitHub...")
    code, out, err = run(["git", "push"])
    if code != 0:
        print(f"❌ Erro no push:\n{err}")
        sys.exit(1)

    print("✅ Push realizado com sucesso!\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Git add + commit + push automático")
    parser.add_argument("-m", "--mensagem", default="", help='Mensagem do commit (ex: -m "fix: correção")')
    parser.add_argument("-f", "--arquivos", nargs="*", help="Arquivos específicos (padrão: todos)")
    args = parser.parse_args()

    git_push(mensagem=args.mensagem, arquivos=args.arquivos)