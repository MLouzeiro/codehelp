@echo off
title Codemed Hub — Build Producao
color 0E
chcp 65001 >nul 2>&1

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     CODEMED HUB — Build para Producao        ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Verificar Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo  [X] Node.js nao encontrado! Instale: https://nodejs.org/
    pause
    exit /b 1
)

:: Step 1: Prisma Generate
echo [1/3] Gerando Prisma Client...
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

:: Step 2: Build Frontend
echo [2/3] Build do frontend (Vite)...
cd frontend
npx vite build
if errorlevel 1 (
    echo  [X] Falha ao buildar frontend!
    cd ..
    pause
    exit /b 1
)
cd ..
echo  [OK] Frontend buildado em frontend\dist\

:: Step 3: Build Backend
echo [3/3] Compilando backend (TypeScript)...
cd backend
npx tsc
if errorlevel 1 (
    echo  [X] Falha ao compilar backend!
    cd ..
    pause
    exit /b 1
)
cd ..
echo  [OK] Backend compilado em backend\dist\

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║           BUILD CONCLUIDO!                    ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo   Frontend: frontend\dist\
echo   Backend:  backend\dist\
echo.
echo   Para iniciar: start.bat
echo.
pause
