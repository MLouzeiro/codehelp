@echo off
title Codemed Hub — Setup Inicial
color 0B
chcp 65001 >nul 2>&1

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║       CODEMED HUB — Setup Inicial            ║
echo  ║       Sistema de Helpdesk & CRM              ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ============================================
:: PASSO 1: Verificar prerequisitos
:: ============================================
echo [1/7] Verificando prerequisitos...
echo.

:: Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo  [X] Node.js NAO encontrado!
    echo      Baixe: https://nodejs.org/ (versao 20+)
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  [OK] Node.js %NODE_VER%

:: npm
npm -v >nul 2>&1
if errorlevel 1 (
    echo  [X] npm NAO encontrado!
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo  [OK] npm %NPM_VER%

:: PostgreSQL (verificar se pg_isready existe)
pg_isready >nul 2>&1
if errorlevel 1 (
    echo  [!] PostgreSQL nao encontrado no PATH.
    echo      Se ja instalou, adicione o diretorio bin ao PATH do sistema.
    echo      Se ainda nao instalou:
    echo        - Windows: https://www.postgresql.org/download/windows/
    echo        - Docker:  docker run -d --name pg -p 5432:5432 -e POSTGRES_USER=codemed -e POSTGRES_PASSWORD=codemed123 -e POSTGRES_DB=codemed_hub postgres:16-alpine
    echo.
) else (
    echo  [OK] PostgreSQL encontrado
)

echo.

:: ============================================
:: PASSO 2: Instalar dependencias
:: ============================================
echo [2/7] Instalando dependencias (backend + frontend)...
echo       Isso pode demorar na primeira vez...
echo.
call npm install
if errorlevel 1 (
    echo  [X] Falha ao instalar dependencias!
    pause
    exit /b 1
)
echo  [OK] Dependencias instaladas.
echo.

:: ============================================
:: PASSO 3: Configurar .env
:: ============================================
echo [3/7] Configurando variaveis de ambiente...
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
        echo  [OK] backend\.env criado a partir do .env.example
    ) else (
        echo  [!] backend\.env.example nao encontrado. Configure manualmente.
    )
) else (
    echo  [OK] backend\.env ja existe.
)

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo  [OK] .env criado a partir do .env.example
    )
)
echo.

:: ============================================
:: PASSO 4: Gerar Prisma Client
:: ============================================
echo [4/7] Gerando Prisma Client...
cd backend
npx prisma generate >nul 2>&1
if errorlevel 1 (
    echo  [X] Falha ao gerar Prisma Client!
    cd ..
    pause
    exit /b 1
)
cd ..
echo  [OK] Prisma Client gerado.
echo.

:: ============================================
:: PASSO 5: Aplicar schema no banco
:: ============================================
echo [5/7] Aplicando schema no banco de dados...
echo       (Certifique-se de que o PostgreSQL esta rodando!)
echo.
cd backend
npx prisma db push --skip-generate
if errorlevel 1 (
    echo  [X] Falha ao aplicar schema!
    echo      Verifique se o PostgreSQL esta rodando e o DATABASE_URL esta correto.
    cd ..
    pause
    exit /b 1
)
cd ..
echo  [OK] Schema aplicado.
echo.

:: ============================================
:: PASSO 6: Executar seed
:: ============================================
echo [6/7] Executando seed (dados iniciais)...
cd backend
npx prisma db seed
if errorlevel 1 (
    echo  [!] Seed falhou (dados podem ja existir). Continuando...
)
cd ..
echo  [OK] Seed concluido.
echo.

:: ============================================
:: PASSO 7: Instrucoes finais
:: ============================================
echo [7/7] Setup concluido!
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║           SETUP CONCLUIDO COM SUCESSO!       ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  PROXIMOS PASSOS:
echo  ──────────────────────────────────────────────
echo   1. Edite backend\.env se necessario
echo   2. Execute dev.bat para iniciar em modo desenvolvimento
echo.
echo  CREDENCIAIS PADRAO:
echo  ──────────────────────────────────────────────
echo   Admin:    admin@codemed.com.br / admin123
echo   Tecnico:  joao@codemed.com.br / tecnico123
echo   Comercial: maria@codemed.com.br / tecnico123
echo   Gerente:  ana@codemed.com.br / tecnico123
echo   Vendedor: pedro@codemed.com.br / tecnico123
echo.
echo  PORTAS:
echo  ──────────────────────────────────────────────
echo   Backend API:  http://localhost:3010
echo   Frontend:     http://localhost:3000
echo   Prisma Studio: http://localhost:5555 (db.bat opcao 2)
echo.
echo  COMANDOS UTILS:
echo  ──────────────────────────────────────────────
echo   dev.bat        Iniciar desenvolvimento
echo   build.bat      Gerar build de producao
echo   start.bat      Iniciar em producao
echo   db.bat         Gerenciar banco de dados
echo.
pause
