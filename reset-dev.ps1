# =============================================================================
# reset-dev.ps1 — Codemed Hub
# Reseta processos zumbis do Node, libera portas 3000/3001 e limpa sessão
# do WhatsApp Web. Deve ser executado como Administrador.
#
# Uso:
#   .\reset-dev.ps1                    # Reset + inicia npm run dev
#   .\reset-dev.ps1 -NoStart           # Reset apenas (não inicia)
#   .\reset-dev.ps1 -KeepSession       # NÃO apaga sessão do WhatsApp
#   .\reset-dev.ps1 -Force             # Não pede confirmação
# =============================================================================

[CmdletBinding()]
param(
    [switch]$NoStart,
    [switch]$KeepSession,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$SessionPath = Join-Path $Root 'backend\whatsapp-session'
$Ports = @(3000, 3001)

function Write-Step($msg) { Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  ✔ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  ✖ $msg" -ForegroundColor Red }

# -----------------------------------------------------------------------------
# Verificação de privilégio
# -----------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
    Write-Err "Este script precisa ser executado como Administrador."
    Write-Host "    Clique-direito no PowerShell → Executar como administrador" -ForegroundColor Gray
    exit 1
}

# -----------------------------------------------------------------------------
# Confirmação
# -----------------------------------------------------------------------------
if (-not $Force) {
    Write-Host ""
    Write-Host "Isso vai:" -ForegroundColor White
    Write-Host "  1. Encerrar TODOS os processos node.exe" -ForegroundColor Gray
    Write-Host "  2. Liberar portas 3000 e 3001" -ForegroundColor Gray
    if (-not $KeepSession) {
        Write-Host "  3. Apagar pasta backend\whatsapp-session (QR Code novo)" -ForegroundColor Yellow
    }
    if (-not $NoStart) {
        Write-Host "  4. Iniciar npm run dev" -ForegroundColor Gray
    }
    $ans = Read-Host "`nContinuar? (s/N)"
    if ($ans -notin @('s', 'S', 'sim', 'Sim', 'SIM', 'y', 'Y', 'yes')) {
        Write-Host "Cancelado." -ForegroundColor Yellow
        exit 0
    }
}

# -----------------------------------------------------------------------------
# 1) Matar processos node
# -----------------------------------------------------------------------------
Write-Step "Encerrando processos node.exe"
$nodeProcs = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcs) {
    Write-Host "    Encontrados: $($nodeProcs.Count) processo(s)" -ForegroundColor Gray
    $nodeProcs | ForEach-Object {
        try {
            Stop-Process -Id $_.Id -Force -ErrorAction Stop
            Write-Ok "PID $($_.Id) encerrado"
        } catch {
            Write-Warn "PID $($_.Id): $($_.Exception.Message)"
        }
    }
    Start-Sleep -Seconds 2
    $remaining = Get-Process node -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Err "Ainda restam $($remaining.Count) processo(s) node. Abortando."
        exit 1
    }
} else {
    Write-Ok "Nenhum processo node em execução"
}

# -----------------------------------------------------------------------------
# 2) Verificar portas livres
# -----------------------------------------------------------------------------
Write-Step "Verificando portas $(($Ports -join ', '))"
$busy = $false
foreach ($p in $Ports) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $busy = $true
        $conn | ForEach-Object {
            Write-Err "Porta $p ocupada por PID $($_.OwningProcess)"
        }
    } else {
        Write-Ok "Porta $p livre"
    }
}
if ($busy) {
    Write-Err "Existem processos presos nas portas. Feche-os manualmente e rode de novo."
    exit 1
}

# -----------------------------------------------------------------------------
# 3) Limpar sessão do WhatsApp
# -----------------------------------------------------------------------------
if (-not $KeepSession) {
    Write-Step "Limpando sessão do WhatsApp"
    if (Test-Path $SessionPath) {
        try {
            Remove-Item -Recurse -Force $SessionPath -ErrorAction Stop
            Write-Ok "Pasta whatsapp-session removida"
        } catch {
            Write-Warn "Falha ao remover: $($_.Exception.Message)"
            Write-Warn "Tente fechar o Gerenciador de Tarefas e rodar de novo."
        }
    } else {
        Write-Ok "Pasta whatsapp-session não existe (ok)"
    }
} else {
    Write-Step "Mantendo sessão do WhatsApp (--KeepSession)"
}

# -----------------------------------------------------------------------------
# 4) Iniciar dev (opcional)
# -----------------------------------------------------------------------------
if ($NoStart) {
    Write-Step "Reset concluído. Use 'npm run dev' para iniciar."
    exit 0
}

Write-Step "Iniciando npm run dev"
Write-Host "    Pressione Ctrl+C para parar`n" -ForegroundColor Gray
Set-Location $Root
try {
    npm run dev
} finally {
    Write-Host "`nEncerrado." -ForegroundColor Yellow
}
