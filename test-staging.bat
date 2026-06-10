@echo off
REM Quick test script to verify staging MongoDB connection
setlocal EnableDelayedExpansion

REM Ensure this script runs from its own directory
cd /d "%~dp0"

echo ========================================================================
echo MongoDB Staging Connection Test (Video Upload Server)
echo ========================================================================
echo.

if not exist ".env" (
	echo ERROR: .env file not found in %CD%
	echo Create video-upload-server .env before running this test.
	echo.
	pause
	exit /b 1
)

set "MONGODB_URI="
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /B /C:"MONGODB_URI=" ".env"`) do (
	set "MONGODB_URI=%%B"
)

if "%MONGODB_URI%"=="" (
	echo ERROR: MONGODB_URI not found in .env
	echo.
	pause
	exit /b 1
)

set "MASKED_URI=%MONGODB_URI%"
for /f "tokens=1,* delims=@" %%A in ("!MASKED_URI!") do (
	set "LEFT=%%A"
	set "RIGHT=%%B"
)
if defined RIGHT (
	for /f "tokens=1,* delims=:" %%A in ("!LEFT!") do (
		set "SCHEME=%%A"
	)
	set "MASKED_URI=!SCHEME!:***@!RIGHT!"
)

set "DB_NAME=unknown"
for /f "tokens=2 delims=/" %%A in ("!MONGODB_URI:mongodb://=!" ) do (
	set "HOST_AND_DB=%%A"
)
for /f "tokens=2 delims=/" %%A in ("!MONGODB_URI!" ) do (
	set "AFTER_HOST=%%A"
)
for /f "tokens=3 delims=/" %%A in ("!MONGODB_URI!" ) do (
	set "RAW_DB=%%A"
)
if defined RAW_DB (
	for /f "tokens=1 delims=?" %%A in ("!RAW_DB!") do set "DB_NAME=%%A"
)

echo Connection summary:
echo   URI: !MASKED_URI!
echo   Database: !DB_NAME!
echo.

echo Tunnel checks:
tasklist /FI "IMAGENAME eq ssh.exe" 2>NUL | find /I "ssh.exe" >NUL
if "%ERRORLEVEL%"=="0" (
	echo   PASS: ssh.exe process detected
) else (
	echo   WARN: No ssh.exe process detected
)

netstat -ano | findstr "127.0.0.1:27018.*LISTENING" >NUL
if "%ERRORLEVEL%"=="0" (
	echo   PASS: Local tunnel port 27018 is listening
) else (
	echo   WARN: Port 27018 is not listening
)
echo.

echo Running detailed database verification...
echo.

node test-staging-connection.js

if not "%ERRORLEVEL%"=="0" (
	echo.
	echo Hint: Start tunnel with scripts\ssh-tunnels\start-ssh-tunnel_staging.bat
)

echo.
pause
