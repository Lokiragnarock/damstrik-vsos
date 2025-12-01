@echo off
setlocal
set "PATH=D:\Program Files 86\Git\cmd;D:\Program Files 86\Git\bin;%PATH%"
echo Checking for Git installation...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Git is not installed or not in your PATH.
    echo Please install Git from https://git-scm.com/downloads and try again.
    pause
    exit /b 1
)

echo Git is installed. Initializing repository...
if not exist .git (
    git init
    echo Repository initialized.
) else (
    echo Repository already initialized.
)

echo.
echo Adding files to staging area (respecting .gitignore)...
git add .

echo.
echo Committing files...
git commit -m "Initial commit"

echo.
echo Please create a new EMPTY repository on GitHub.
set /p REPO_URL="Enter the GitHub Repository URL (e.g., https://github.com/username/repo.git): "

if "%REPO_URL%"=="" (
    echo No URL provided. Exiting.
    pause
    exit /b 1
)

echo.
echo Adding remote origin...
git remote add origin %REPO_URL%
if %errorlevel% neq 0 (
    echo Remote 'origin' might already exist. Setting URL...
    git remote set-url origin %REPO_URL%
)

echo.
echo Pushing to GitHub...
git branch -M main
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo Push failed. Please check your URL and internet connection.
    pause
    exit /b 1
)

echo.
echo Successfully pushed to GitHub!
pause
