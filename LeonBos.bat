@echo off
chcp 65001 >nul 2>&1
title LeonBos
color 0A
cls

echo ========================================
echo   LeonBos - 指纹浏览器 v1.0.0
echo ========================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js not found!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js found
echo.

:: Check node_modules
if not exist "node_modules\" (
    echo [First Run] Installing dependencies...
    echo This may take 1-2 minutes...
    call npm install
    if %errorlevel% neq 0 (
        echo [Error] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
echo.
)

echo [Starting] Launching LeonBos...
echo [Info] Browser will open automatically
echo.
echo ========================================
echo.

node src/main.js

echo.
echo [Stopped] LeonBos exited
echo.
pause
