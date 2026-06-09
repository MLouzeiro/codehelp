@echo off
title Codemed Hub — Setup
color 0B

echo ============================================
echo   CODEMED HUB — Setup Inicial
echo ============================================
echo.

:: Verificar Node.js
echo [1/6] Verificando Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao encontrado!
    echo Baixe em: https://nodejs.org/
    echo Versao minima: 20.0.0
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo       Node.js %NODE_VER% encontrado.

:: Verificar npm
echo [2/6] Verificando npm...
npm -v >nul 2>&1
if errorlevel 1 (
    echo ERRO: npm nao encontrado!
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo       npm %NPM_VER% encontrado.

:: Instalar dependencias
echo [3/6] Instalando dependencias...
echo       Isso pode demorar na primeira vez...
call npm install
if errorlevel 1 (
    echo ERRO: Falha ao instalar dependencias!
    pause
    exit /b 1
)
echo       Dependencias instaladas.

:: Configurar .env
echo [4/6] Configurando variaveis de ambiente...
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
        echo       Arquivo backend\.env criado a partir do .env.example
        echo       IMPORTANTE: Edite backend\.env com suas credenciais!
    ) else (
        echo       AVISO: backend\.env.example nao encontrado. Configure manualmente.
    )
) else (
    echo       Arquivo backend\.env ja existe. Ignorando.
)

:: Gerar Prisma Client
echo [5/6] Gerando Prisma Client...
cd backend
npx prisma generate
if errorlevel 1 (
    echo ERRO: Falha ao gerar Prisma Client!
    cd ..
    pause
    exit /b 1
)
cd ..
echo       Prisma Client gerado.

:: Push schema + Seed
echo [6/6] Aplicando schema no banco e executando seed...
cd backend
npx prisma db push --skip-generate
if errorlevel 1 (
    echo ERRO: Falha ao aplicar schema!
    cd ..
    pause
    exit /b 1
)
npx prisma db seed
if errorlevel 1 (
    echo AVISO: Seed falhou (pode ser que os dados ja existam). Continuando...
)
cd ..

echo.
echo ============================================
echo   SETUP CONCLUIDO!
echo ============================================
echo.
echo Proximos passos:
echo   1. Edite backend\.env com suas credenciais de banco
echo   2. Execute: dev.bat
echo.
echo Credenciais padrao:
echo   Admin: admin@codemed.com.br / admin123
echo   Tecnico: joao@codemed.com.br / tecnico123
echo.
pause
