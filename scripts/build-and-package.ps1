param(
  [switch]$EnableMockAuth
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "dist"
$wrapperRoot = Join-Path $projectRoot "spring-wrapper"
$staticPath = Join-Path $wrapperRoot "src\main\resources\static"

Write-Host "Building React frontend..."
Push-Location $projectRoot
try {
  if ($EnableMockAuth) {
    $env:VITE_ENABLE_MOCK_AUTH = "true"
    Write-Host "Mock authentication enabled for this build."
  } else {
    Remove-Item Env:VITE_ENABLE_MOCK_AUTH -ErrorAction SilentlyContinue
  }
  npm run build
}
finally {
  if ($EnableMockAuth) {
    Remove-Item Env:VITE_ENABLE_MOCK_AUTH -ErrorAction SilentlyContinue
  }
  Pop-Location
}

if (!(Test-Path $distPath)) {
  throw "Frontend build output was not found at $distPath"
}

if (!(Test-Path $staticPath)) {
  New-Item -ItemType Directory -Path $staticPath -Force | Out-Null
}

Write-Host "Syncing frontend build into Spring Boot wrapper..."
Get-ChildItem -Path $staticPath -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $distPath "*") -Destination $staticPath -Recurse -Force

Write-Host "Packaging Spring Boot wrapper as a WAR..."
Push-Location $wrapperRoot
try {
  mvn clean package
}
finally {
  Pop-Location
}

$warPath = Join-Path $wrapperRoot "target\spring-wrapper-0.0.1-SNAPSHOT.war"
if (Test-Path $warPath) {
  Write-Host "Wrapper package complete: $warPath"
} else {
  throw "Expected WAR was not created at $warPath"
}
