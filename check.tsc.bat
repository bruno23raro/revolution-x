@echo off
cd /d C:\Users\Bruno\.claude\Revolution\X
node node_modules\.bin\tsc --noEmit
echo Error level: %errorlevel%