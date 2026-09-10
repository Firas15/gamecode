@echo off
rem ============================================================
rem  Local migration runner (Windows, native PostgreSQL)
rem
rem  Applies every db\migrations\*.sql to the local database.
rem  All migrations are idempotent (IF NOT EXISTS), so running
rem  this twice is safe and changes nothing the second time.
rem
rem  On the server migrations run automatically from the Docker
rem  entrypoint; this script is the local equivalent.
rem
rem  Usage:  scripts\migrate-local.cmd
rem  psql asks for the password (see config.php).
rem
rem  Override defaults if needed:
rem     set PGHOST=localhost
rem     set PGPORT=5432
rem     set PGDATABASE=gamecode
rem     set PGUSER=gamecode_user
rem ============================================================
setlocal enabledelayedexpansion

if "%PGHOST%"==""     set PGHOST=localhost
if "%PGPORT%"==""     set PGPORT=5432
if "%PGDATABASE%"=="" set PGDATABASE=gamecode
if "%PGUSER%"==""     set PGUSER=gamecode_user

rem Migration files are UTF-8. Without this psql assumes the console
rem codepage (WIN1251 on a Russian Windows) and fails on the first
rem character that has no WIN1251 equivalent.
set PGCLIENTENCODING=UTF8

rem Find psql: PATH first, then the standard install location.
set PSQL=psql
where psql >nul 2>&1
if errorlevel 1 (
    set PSQL=
    for %%V in (18 17 16 15 14) do (
        if exist "C:\Program Files\PostgreSQL\%%V\bin\psql.exe" (
            if "!PSQL!"=="" set PSQL="C:\Program Files\PostgreSQL\%%V\bin\psql.exe"
        )
    )
)
if "%PSQL%"=="" (
    echo [ERROR] psql not found. Add PostgreSQL's bin folder to PATH
    echo         or edit the PSQL variable in this script.
    exit /b 1
)

set ROOT=%~dp0..
set FAILED=0

echo Database: %PGUSER%@%PGHOST%:%PGPORT%/%PGDATABASE%
echo.

for %%F in ("%ROOT%\db\migrations\*.sql") do (
    %PSQL% -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -v ON_ERROR_STOP=1 -q -f "%%F"
    if errorlevel 1 (
        echo [FAIL] %%~nxF
        set FAILED=1
    ) else (
        echo [ OK ] %%~nxF
    )
)

echo.
if "%FAILED%"=="1" (
    echo Some migrations failed - see the messages above.
    exit /b 1
)
echo All migrations applied.
exit /b 0
