@echo off
title Codemed Hub — Desenvolvimento
color 0A
chcp 65001 >nul 2>&1

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     CODEMED HUB — Modo Desenvolvimento       ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo   Backend API:  http://localhost:3010
echo   Frontend:     http://localhost:3000
echo   Prisma Studio: http://localhost:5555 (db.bat ^> 2)
echo.
echo   Pressione Ctrl+C para parar os servidores
echo ───────────────────────────────────────────────
echo.

npm run dev
