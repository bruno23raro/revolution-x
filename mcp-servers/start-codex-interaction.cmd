@echo off
REM ============================================================================
REM Script de Inicialização para Interação Codex - Revolution X
REM ============================================================================
REM Este script inicia o dashboard de interação e fornece comandos
REM para colaboração entre Claude Code e Codex.
REM ============================================================================

echo.
echo ========================================
echo  🤖 Interatividade Codex - Revolution X
echo ========================================
echo.

echo 📁 Arquivos criados:
echo    - mcp-servers/github-custom-server.js
echo    - mcp-servers/vercel-custom-server.js
echo    - mcp-servers/diagnose-mcp-auth.js
echo    - mcp-servers/interactive-dashboard.html
echo    - mcp-servers/README.md
echo.

echo 🔧 MCPs configurados:
echo    - github-custom (servidor custom)
echo    - vercel-custom (servidor custom)
echo.

echo ========================================
echo  📌 Próximos passos:
echo ========================================
echo.
echo 1. Abra o dashboard:
echo    start mcp-servers\interactive-dashboard.html
echo.
echo 2. No Claude Code, execute: /mcp
echo    - Ative 'github-custom'
echo    - Ative 'vercel-custom'
echo.
echo 3. Para diagnóstico:
echo    cmd /c node mcp-servers\diagnose-mcp-auth.js
echo.
echo 4. Para reconfigurar tokens:
echo    .\mcp-servers\setup-mcp-auth.ps1
echo.
echo ========================================

pause