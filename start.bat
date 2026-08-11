@echo off
title Codemed Hub — Producao
color 0A
chcp 65001 >nul 2>&1

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║       CODEMED HUB — Modo Producao            ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo   URL: http://localhost:3010
echo.
echo   Pressione Ctrl+C para parar
echo ───────────────────────────────────────────────
echo.

cd backend
node dist/server.js
