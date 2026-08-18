param(
  [string]$ImageName = "sparkfigma-app",
  [string]$ImageTag = "latest",
  [switch]$SkipPackage,
  [switch]$EnableMockAuth
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageScript = Join-Path $PSScriptRoot "build-and-package.ps1"
$fullImageName = "${ImageName}:${ImageTag}"

if (!$SkipPackage) {
  Write-Host "Running wrapper packaging before Docker build..."
  if ($EnableMockAuth) {
    & $packageScript -EnableMockAuth
  } else {
    & $packageScript
  }
}

Write-Host "Building Docker image $fullImageName ..."
Push-Location $projectRoot
try {
  $mockAuthValue = if ($EnableMockAuth) { "true" } else { "false" }
  docker build --build-arg VITE_ENABLE_MOCK_AUTH=$mockAuthValue -t $fullImageName .
}
finally {
  Pop-Location
}

Write-Host "Docker image ready: $fullImageName"
