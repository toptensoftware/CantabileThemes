@echo off

echo Building theme packages...

if EXIST "%~dp0build\" rd /s /q "%~dp0build\"
mkdir "%~dp0build\"

for /D %%D in ("*.theme") do (
	if exist .\Build\%%D del .\Build\%%D
	zip -0 -j .\Build\%%D %%D\* > NUL
)

for /D %%D in ("*.webfolder") do (
	if exist .\Build\%%D del .\Build\%%D
	zip -0 -j .\Build\%%D %%D\*
)

echo.