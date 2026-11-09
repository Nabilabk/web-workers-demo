@echo off
REM Lance un petit serveur local (les workers ne marchent pas en file://)
cd /d "%~dp0"
echo Demo disponible sur http://localhost:8000
echo Fermez cette fenetre pour arreter le serveur.
start "" http://localhost:8000
py -m http.server 8000
