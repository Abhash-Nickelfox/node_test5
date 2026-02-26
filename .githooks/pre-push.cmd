@echo off
:: NFXinit Windows pre-push hook wrapper
:: Calls the Node.js gate runner script
node "%~dp0..\scripts\prepush.mjs" %*
exit /b %ERRORLEVEL%
