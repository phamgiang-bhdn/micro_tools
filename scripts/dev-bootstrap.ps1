# =============================================================================
# micro_tools — gom lệnh local (PowerShell)
# Chạy:  cd ...\micro_tools ; .\scripts\dev-bootstrap.ps1
# (Giờ gọi npm run bootstrap — có banner màu trong terminal Node)
# =============================================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "`nChạy npm run bootstrap (Docker + migrate + seed, có màu)...`n" -ForegroundColor Cyan
npm run bootstrap

Write-Host "`n=== Tiếp theo: mở 2 terminal ===" -ForegroundColor Magenta
Write-Host "  Terminal A:  npm run dev:api" -ForegroundColor White
Write-Host "  Terminal B:  npm run dev:web" -ForegroundColor White
Write-Host "  Web: http://localhost:3100  |  Admin: http://localhost:3100/admin" -ForegroundColor White
Write-Host "  API: http://localhost:4000/api/v1/tools" -ForegroundColor White
Write-Host "  pgAdmin: http://localhost:5050`n" -ForegroundColor White
