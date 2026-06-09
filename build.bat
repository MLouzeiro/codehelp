@echo off
title Codemed Hub — Build Producao
color 0E

echo ============================================
echo   CODEMED HUB — Build para Producao
echo ============================================
echo.

echo [1/3] Gerando Prisma Client...
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

echo [2/3] Build do frontend...
cd frontend
npx vite build
if errorlevel 1 (
    echo ERRO: Falha ao buildar frontend!
    cd ..
    pause
    exit /b 1
)
cd ..
echo       Frontend buildado.

echo [3/3] Build do backend...
cd backend
npx tsc
if errorlevel 1 (
    echo ERRO: Falha ao compilar backend!
    cd ..
    pause
    exit /b 1
)
cd ..
echo       Backend compilado.

echo.
echo ============================================
echo   BUILD CONCLUIDO!
echo ============================================
echo.
echo   Frontend: frontend/dist/
echo   Backend:  backend/dist/
echo.
echo   Para iniciar em producao: start.bat
echo.
pause
