@echo off
setlocal
cd /d "%~dp0"
set "MYSQL_ROOT=C:\Program Files\MySQL\MySQL Server 8.4"
set "MYSQL_DATA=%~dp0.mysql-data"

netstat -ano | findstr ":3306" >nul
if errorlevel 1 start "School MySQL" /B "%MYSQL_ROOT%\bin\mysqld.exe" --basedir="%MYSQL_ROOT%" --datadir="%MYSQL_DATA%" --innodb-undo-directory="%MYSQL_DATA%" --port=3306

timeout /t 2 /nobreak >nul
npm.cmd start
