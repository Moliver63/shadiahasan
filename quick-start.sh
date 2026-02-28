#!/bin/bash

# ========================================
# Quick Start Script - Shadia Hasan Platform
# ========================================
# Este script facilita o setup inicial do projeto

set -e  # Para na primeira falha

echo "🚀 Shadia Hasan Platform - Quick Start"
echo "======================================"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale em: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) encontrado"

# Verificar pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 pnpm não encontrado. Instalando..."
    npm install -g pnpm
fi

echo "✅ pnpm $(pnpm --version) encontrado"
echo ""

# Instalar dependências
echo "📦 Instalando dependências..."
pnpm install
echo "✅ Dependências instaladas"
echo ""

# Verificar .env
if [ ! -f .env ]; then
    echo "⚠️  Arquivo .env não encontrado!"
    echo ""
    echo "Crie um arquivo .env na raiz do projeto com:"
    echo "  DATABASE_URL=mysql://root:senha@localhost:3306/shadia_vr_platform"
    echo "  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
    echo "  NODE_ENV=development"
    echo "  PORT=3000"
    echo ""
    echo "Consulte LOCAL_SETUP.md para mais detalhes."
    exit 1
fi

echo "✅ Arquivo .env encontrado"
echo ""

# Verificar banco de dados
echo "🗄️  Verificando conexão com banco de dados..."
if pnpm db:push > /dev/null 2>&1; then
    echo "✅ Banco de dados configurado"
else
    echo "⚠️  Falha ao conectar ao banco. Verifique DATABASE_URL no .env"
    exit 1
fi
echo ""

# Criar super admin
echo "👤 Criando super admin..."
if [ -f server/scripts/seed-superadmin.ts ]; then
    pnpm tsx server/scripts/seed-superadmin.ts || echo "⚠️  Super admin pode já existir"
fi
echo ""

echo "======================================"
echo "✅ Setup completo!"
echo ""
echo "Para iniciar o servidor:"
echo "  pnpm dev"
echo ""
echo "Acesse: http://localhost:3000"
echo ""
echo "Credenciais admin:"
echo "  Email: admin@shadiahasan.club"
echo "  Senha: Admin@123"
echo "======================================"
