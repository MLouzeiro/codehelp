@echo off
title Codemed Hub — Banco de Dados
color 0D
chcp 65001 >nul 2>&1

:menu
cls
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     CODEMED HUB — Gerenciamento do Banco     ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo   [1] Seed (popular dados padrao)
echo   [2] Prisma Studio (interface web)
echo   [3] Push schema (aplicar mudancas)
echo   [4] Migrate (criar migration)
echo   [5] Reset seed (repopular tudo)
echo   [6] Status do banco
echo   [0] Sair
echo.
echo ───────────────────────────────────────────────
echo.

set /p opcao="Escolha uma opcao: "

if "%opcao%"=="1" goto seed
if "%opcao%"=="2" goto studio
if "%opcao%"=="3" goto push
if "%opcao%"=="4" goto migrate
if "%opcao%"=="5" goto resetseed
if "%opcao%"=="6" goto status
if "%opcao%"=="0" goto end

echo  [X] Opcao invalida!
timeout /t 2 >nul
goto menu

:seed
echo.
echo  Executando seed...
cd backend
npx prisma db seed
cd ..
echo.
pause
goto menu

:studio
echo.
echo  Abrindo Prisma Studio na porta 5555...
echo  (Feche o navegador para voltar ao menu)
cd backend
npx prisma studio
cd ..
pause
goto menu

:push
echo.
echo  Aplicando schema ao banco...
cd backend
npx prisma db push
cd ..
echo.
pause
goto menu

:migrate
echo.
set /p nome="Nome da migration: "
if "%nome%"=="" (
    echo  [X] Nome nao pode ser vazio!
    timeout /t 2 >nul
    goto menu
)
cd backend
npx prisma migrate dev --name %nome%
cd ..
echo.
pause
goto menu

:resetseed
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║  ATENCAO: Isso vai recriar os dados padrao!  ║
echo  ╚══════════════════════════════════════════════╝
echo.
set /p confirma="Continuar? (s/N): "
if /i not "%confirma%"=="s" goto menu
echo.
cd backend
npx prisma db push --skip-generate
npx prisma db seed
cd ..
echo.
pause
goto menu

:status
echo.
echo  Verificando status do banco...
cd backend
npx prisma db push --skip-generate 2>&1
echo.
npx prisma generate >nul 2>&1
echo  Prisma Client: OK
cd ..
echo.
pause
goto menu

:end
