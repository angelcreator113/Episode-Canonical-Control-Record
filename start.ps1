Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.Path -like "*Episode-Canonical-Control-Record-1*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\12483\Projects\Episode-Canonical-Control-Record-1'; npm run dev"
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend'; npm run dev"
Start-Sleep -Seconds 5
Start-Process http://localhost:5173
