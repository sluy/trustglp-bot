$path = "apps\admin-dashboard\app\admin\community\page.tsx"
$c = [IO.File]::ReadAllText($path)
$bullet = [char]0x2022
$old = "Long 3x " + $bullet + " {displayLabel}"
$new = "Long {displayLeverage} " + $bullet + " {displayLabel}"
$c2 = $c.Replace($old, $new)
[IO.File]::WriteAllText($path, $c2)
Write-Host ("Replaced: " + ($c -ne $c2))
