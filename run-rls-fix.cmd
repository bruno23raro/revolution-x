@echo off
REM Script para aplicar migration 029 - correção RLS
REM Executar com: run-rls-fix.cmd --apply

setlocal enabledelayedexpansion

echo ============================================================
echo   APLICAÇÃO MIGRATION 029 - CORREÇÃO RLS
echo ============================================================
echo.

REM Verificar se temos node instalado
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "NPM_EXE=C:\Program Files\nodejs\npm.exe"

if not exist "%NODE_EXE%" (
    echo ERRO: Node.js não encontrado em %NODE_EXE%
    exit /b 1
)

echo Node.js: %NODE_EXE%
"%NODE_EXE%" --version
echo.

REM Verificar psql
where psql >nul 2>&1
if errorlevel 1 (
    echo WARNING: psql não encontrado no PATH
    echo Tentando localizar psql...

    REM Verificar vias comuns do PostgreSQL
    for %%p in (
        "C:\Program Files\PostgreSQL"
        "C:\Program Files (x86)\PostgreSQL"
    ) do (
        if exist "%%p" (
            for /d %%d in ("%%p\*") do (
                if exist "%%d\bin\psql.exe" (
                    set "PG_BIN=%%d\bin"
                    echo Encontrado psql em: %%d\bin
                )
            )
        )
    )
) else (
    echo psql encontrado
)
echo.

REM Verificar DATABASE_URL
if "%DATABASE_URL%"=="" (
    echo ❌ ERRO: DATABASE_URL environment variable is required
    echo Configure via:
    echo   - Arquivo .env: DATABASE_URL="postgresql://..."
    echo   - Ou use .env.local com credenciais Supabase
    exit /b 1
)

echo ============================================================
echo Configurações:
echo   Database: %DATABASE_URL:%PASSWORD%=%
echo ============================================================
echo.

REM Executar script Node.js
echo Executando migration via Node.js...
"%NODE_EXE%" scripts/apply-rls-fix-direct.js
echo.

echo ============================================================
echo Próximos passos:
echo 1. Verificar RLS habilitado
echo 2. Verificar policies criadas
echo 3. Testar isolamento multi-tenant
echo ============================================================

endlocal