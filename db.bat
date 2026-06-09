@echo off
title Codemed Hub — Banco de Dados
color 0D

echo ============================================
echo   CODEMED HUB — Gerenciamento do Banco
echo ============================================
echo.
echo   [1] Seed (popular dados padrao)
echo   [2] Prisma Studio (interface web)
echo   [3] Push schema (aplicar mudancas)
echo   [4] Migrate (criar migration)
echo   [5] Reset seed (repopular tudo)
echo   [0] Sair
echo.
echo ============================================
echo.

set /p opcao="Escolha uma opcao: "

if "%opcao%"=="1" goto seed
if "%opcao%"=="2" goto studio
if "%opcao%"=="3" goto push
if "%opcao%"=="4" goto migrate
if "%opcao%"=="5" goto resetseed
if "%opcao%"=="0" goto end

echo Opcao invalida!
pause
goto end

:seed
echo.
echo Executando seed...
cd backend
npx prisma db seed
cd ..
echo.
pause
goto end

:studio
echo.
echo Abrindo Prisma Studio na porta 5555...
echo Feche o navegador para voltar ao menu.
cd backend
npx prisma studio
cd ..
pause
goto end

:push
echo.
echo Aplicando schema ao banco...
cd backend
npx prisma db push
cd ..
echo.
pause
goto end

:migrate
echo.
set /p nome="Nome da migration: "
cd backend
npx prisma migrate dev --name %nome%
cd ..
echo.
pause
goto end

:resetseed
echo.
echo ATENCAO: Isso vai recriar os dados padrao!
set /p confirma="Continuar? (s/N): "
if /i not "%confirma%"=="s" goto end
echo.
cd backend
npx prisma db push --skip-generate
npx prisma db seed
cd ..
echo.
pause
goto end

:end
