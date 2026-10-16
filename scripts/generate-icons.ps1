Add-Type -AssemblyName System.Drawing
$srcPath = "d:\EKDANT\ATTENDANCE SYSTEM\attends logo.png"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

function Generate-Icon([int]$size, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::White)

    $scale = [Math]::Min($size / $src.Width, $size / $src.Height)
    $w = [int]($src.Width * $scale)
    $h = [int]($src.Height * $scale)
    $x = [int](($size - $w) / 2)
    $y = [int](($size - $h) / 2)

    $g.DrawImage($src, $x, $y, $w, $h)
    $g.Dispose()

    $parentDir = [System.IO.Path]::GetDirectoryName($outPath)
    if (!(Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated $outPath ($size x $size)"
}

$androidRes = "d:\EKDANT\ATTENDANCE SYSTEM\android\app\src\main\res"
if (Test-Path $androidRes) {
    Generate-Icon 48  "$androidRes\mipmap-mdpi\ic_launcher.png"
    Generate-Icon 48  "$androidRes\mipmap-mdpi\ic_launcher_round.png"
    Generate-Icon 72  "$androidRes\mipmap-hdpi\ic_launcher.png"
    Generate-Icon 72  "$androidRes\mipmap-hdpi\ic_launcher_round.png"
    Generate-Icon 96  "$androidRes\mipmap-xhdpi\ic_launcher.png"
    Generate-Icon 96  "$androidRes\mipmap-xhdpi\ic_launcher_round.png"
    Generate-Icon 144 "$androidRes\mipmap-xxhdpi\ic_launcher.png"
    Generate-Icon 144 "$androidRes\mipmap-xxhdpi\ic_launcher_round.png"
    Generate-Icon 192 "$androidRes\mipmap-xxxhdpi\ic_launcher.png"
    Generate-Icon 192 "$androidRes\mipmap-xxxhdpi\ic_launcher_round.png"
}

Generate-Icon 256 "d:\EKDANT\ATTENDANCE SYSTEM\build\icon.png"
Generate-Icon 512 "d:\EKDANT\ATTENDANCE SYSTEM\public\icon-512.png"

$src.Dispose()
Write-Host "All icons generated successfully!"
