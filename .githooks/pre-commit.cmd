@echo off
:: NFXinit Windows pre-commit hook wrapper
:: Calls the Node.js gate runner script
node "%~dp0..\scripts\precommit.mjs" %*
exit /b %ERRORLEVEL%
