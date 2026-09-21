$files = @(
  'C:\Users\USER\Desktop\buissnesss\smartestate\public\email-logo.png',
  'C:\Users\USER\Desktop\buissnesss\smartestate\public\logo.png',
  'C:\Users\USER\Desktop\buissnesss\smartestate\public\icon.svg'
)
Get-Item $files | Select-Object Name, Length | Format-Table -AutoSize
Add-Type -AssemblyName System.Drawing
foreach ($f in @('email-logo.png', 'logo.png')) {
  $p = Join-Path 'C:\Users\USER\Desktop\buissnesss\smartestate\public' $f
  $img = [System.Drawing.Image]::FromFile($p)
  Write-Output "$f $($img.Width)x$($img.Height)"
  $img.Dispose()
}
