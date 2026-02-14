SHADIA HASAN - HOSTGATOR DEPLOY GUIDE

STEP 1 - Install dependencies
pnpm install

STEP 2 - Build project
pnpm run build

STEP 3 - Configure Node.js App in HostGator (cPanel)
- Application Root: project folder
- Startup File: dist/index.js
- Node Version: 20+ recommended

STEP 4 - Set environment variables
Either:
- Use .env file in project root
OR
- Configure in cPanel > Setup Node.js App > Environment Variables

STEP 5 - Restart application

OPTIONAL:
Run env_scanner.py to automatically detect required environment variables.

python env_scanner.py

Author: Maple 15/10 Deployment Mode 🚀
