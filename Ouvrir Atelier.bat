@echo off
rem Lance le site Atelier et ouvre le navigateur. Rien a installer (pas de Python) :
rem le serveur est un script PowerShell, present sur tout Windows (tools\atelier-server.ps1).
rem Pour arreter le site, fermer la fenetre "Atelier server" (reduite dans la barre des taches).
cd /d "%~dp0"
start "Atelier server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\atelier-server.ps1" -Port 5500
