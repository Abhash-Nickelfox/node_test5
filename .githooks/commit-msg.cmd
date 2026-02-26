@echo off
:: NFXinit Windows commit-msg hook wrapper
:: Calls the Node.js gate runner script
node "%~dp0..\scripts\commitmsg.mjs" %1
exit /b %ERRORLEVEL%
