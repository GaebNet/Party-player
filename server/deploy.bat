@echo off
REM Railway deployment script for Windows

echo 🚀 Deploying Watch Party Backend to Railway...

REM Check if Railway CLI is installed
railway --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Railway CLI not found. Install it with: npm install -g @railway/cli
    pause
    exit /b 1
)

REM Check if logged in
railway whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔑 Please login to Railway first:
    echo railway login
    pause
    exit /b 1
)

REM Initialize if not already done
if not exist ".railway" (
    echo 📁 Initializing Railway project...
    railway init --name "watch-party-backend"
)

REM Deploy
echo ⬆️  Deploying to Railway...
railway up

REM Get domain
echo 🌐 Getting deployment URL...
timeout /t 5 /nobreak >nul
railway domain

echo ✅ Deployment complete!
echo 📝 Remember to update NEXT_PUBLIC_SERVER_URL in your Netlify dashboard with the Railway URL
pause