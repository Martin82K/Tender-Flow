Add-Type -AssemblyName System.Drawing
$sourcePath = Join-Path (Get-Location) "source_icon.png"
$destPath = Join-Path (Get-Location) "tender-flow.ico"

Write-Host "Reading from $sourcePath"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source file not found!"
    exit 1
}

try {
    $img = [System.Drawing.Image]::FromFile($sourcePath)
    $bmp = New-Object System.Drawing.Bitmap($img, 256, 256)
    $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    
    $fs = New-Object System.IO.FileStream($destPath, "Create")
    $icon.Save($fs)
    $fs.Close()
    
    $bmp.Dispose()
    $img.Dispose()
    $icon.Dispose()
    Write-Host "ICO created successfully at $destPath"
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
