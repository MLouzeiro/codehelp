@echo off
title Codemed Hub — Producao
color 0A

echo ============================================
echo   CODEMED HUB — Modo Producao
echo ============================================
echo.
echo   Porta: 3010
echo   URL:   http://localhost:3010
echo.
echo   Pressione Ctrl+C para parar
echo ============================================
echo.

cd backend
node dist/server.js
