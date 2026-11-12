@echo off
cd /d "C:\Users\Bruno\.claude\Revolution\X"

REM Limpar cache Next.js
if exist .next (
    rmdir /s /q .next
    echo .next cache removed
) else (
    echo No .next cache found
)

REM Configurar variáveis de ambiente para porta 4000
set PORT=4000
set NODE_ENV=development
set RX_DEMO_MODE=1
set NEXT_PUBLIC_SITE_URL=http://localhost:4000

echo Starting demo server on port 4000...
call npm run dev:demo