@echo off
cd /d C:\Users\Bruno\.claude\Revolution\X
npm test -- --no-coverage
echo Error level: %errorlevel%