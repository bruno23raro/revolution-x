@echo off
REM Setup Script para Ambiente de Demo Revolution X - OpenBSP
REM Uso: setup-demo.bat [comando]
REM Comandos: start, stop, status, seed, reset, full

if "%1"=="" goto :usage
if "%1"=="start" goto :start
if "%1"=="stop" goto :stop
if "%1"=="status" goto :status
if "%1"=="seed" goto :seed
if "%1"=="reset" goto :reset
if "%1"=="full" goto :full
if "%1"=="usage" goto :usage
goto :usage

:usage
echo Uso: setup-demo.bat [comando]
echo.
echo Comandos:
echo   start   - Configura .env.local para ambiente de demo
echo   stop    - Para o ambiente de demo
echo   status  - Verifica status do ambiente
echo   seed    - Executa seed de dados de exemplo
echo   reset   - Reseta ambiente para estado limpo
echo   full    - Execute setup completo (docker up, migrate, seed, start)
goto :eof

:start
echo [Demo] Configurando ambiente de demonstração...
echo NODE_ENV=development > .env.local
echo RX_DEMO_MODE=1 >> .env.local
echo NEXT_PUBLIC_SITE_URL=http://localhost:3000 >> .env.local
echo PORT=3000 >> .env.local
echo SUPABASE_URL=http://localhost:54321 >> .env.local
echo DATABASE_URL=postgresql://postgres:rx593ce2@localhost:54321/revolution_x >> .env.local
echo.
echo [Demo] Ambiente configurado com sucesso!
echo [Demo] Rode 'setup-demo.bat full' para iniciar tudo
goto :eof

:stop
echo [Demo] Paradendo ambiente de demo...
taskkill /f /im node.exe 2>nul
taskkill /f /im next.exe 2>nul

REM Parar containers Docker se estiverem rodando
cd supabase-docker 2>nul
if exist docker-compose.yml (
    docker compose down 2>nul
)
cd ..
echo [Demo] Ambiente parado.
goto :eof

:status
echo [Demo] Verificando status do ambiente...
if exist .env.local (
    echo [OK] Arquivo .env.local existe
    findstr "NODE_ENV" .env.local >nul && echo [OK] NODE_ENV configurado
    findstr "RX_DEMO_MODE" .env.local >nul && echo [OK] RX_DEMO_MODE configurado
) else (
    echo [ERRO] Arquivo .env.local nao encontrado
)

REM Verificar se Docker está rodando
docker info >nul 2>&1
if errorlevel 1 (
    echo [AVISO] Docker não está rodando
) else (
    echo [OK] Docker está ativo

    REM Verificar containers
    docker ps --format "table {{.Names}}\\t{{.Status}}" 2>nul | findstr "supabase" >nul
    if errorlevel 1 (
        echo [AVISO] Containers Supabase não estão rodando
    ) else (
        echo [OK] Containers Supabase estão ativos
    )
)

REM Verificar porta 3000
net session >nul 2>&1
powershell -Command "if (Test-NetConnection -Port 3000 -InformationLevel 'Quiet') { exit 0 } else { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo [AVISO] Porta 3000 não está sendo usada
) else (
    echo [OK] Servidor pode ouvir na porta 3000
)
goto :eof

:seed
echo [Demo] Executando seed de dados de exemplo...
if not exist .env.local (
    echo [ERRO] Arquivo .env.local não encontrado. Execute 'setup-demo.bat start' primeiro.
    exit /b 1
)

REM Verificar se DATABASE_URL aponta para localhost
findstr "localhost" .env.local >nul
if errorlevel 1 (
    echo [ERRO] DATABASE_URL não aponta para localhost. Seed só funciona com stack local.
    echo [DETALHE] Edite .env.local para usar localhost:54321
    exit /b 1
)

echo [Demo] Executando npx tsx prisma/seed-demo.ts...
npx tsx prisma/seed-demo.ts
if errorlevel 1 (
    echo [ERRO] Falha ao executar seed
    exit /b 1
)
echo [Demo] Seed concluido com sucesso!
echo [Demo] Acesse http://localhost:3000/dev para entrar no modo demo
goto :eof

:reset
echo [Demo] Resetando ambiente de demo...
if exist .env.local del .env.local
echo [Demo] Reset concluido. Configure novamente com 'setup-demo.bat start'.
goto :eof

:full
echo [Demo] Executando setup completo...
echo.

REM Passo 1: Configurar .env.local
call :start
echo [OK] .env.local configurado

REM Passo 2: Iniciar Docker
echo [Demo] Iniciando stack Supabase local...
cd supabase-docker
if exist docker-compose.yml (
    docker compose up -d
    if errorlevel 1 (
        echo [ERRO] Falha ao iniciar Docker
        cd ..
        exit /b 1
    )
) else (
    echo [AVISO] docker-compose.yml não encontrado em supabase-docker/
)
cd ..

REM Aguardar containers iniciarem
echo [Demo] Aguardando containers iniciarem (30 segundos)...
timeout /t 30 /nobreak >nul

REM Passo 3: Executar migrations
echo [Demo] Executando migrations...
npm run db:migrate
if errorlevel 1 (
    echo [ERRO] Falha nas migrations
    exit /b 1
)
echo [OK] Migrations executadas

REM Passo 4: Executar seed
call :seed
if errorlevel 1 (
    echo [ERRO] Falha no seed
    exit /b 1
)

REM Passo 5: Iniciar servidor
echo [Demo] Iniciando servidor Next.js...
npm run dev:demo
goto :eof