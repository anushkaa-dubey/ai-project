$bodySafe = @{grade=80; machine_speed=700; stock_flow=350; headbox_pressure=0.55; steam_pressure=5.1; dryer_temperature=128; moisture=4.8; pulp_consistency=0.76; basis_weight=80} | ConvertTo-Json
$bodyCritical = @{grade=80; machine_speed=1000; stock_flow=500; headbox_pressure=0.85; steam_pressure=6.5; dryer_temperature=160; moisture=2.5; pulp_consistency=0.95; basis_weight=95} | ConvertTo-Json
Write-Host 'SAFE'
Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/simulate' -ContentType 'application/json' -Body $bodySafe | ConvertTo-Json -Depth 8
Write-Host 'CRITICAL'
Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/simulate' -ContentType 'application/json' -Body $bodyCritical | ConvertTo-Json -Depth 8
