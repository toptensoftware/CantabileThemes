@echo off


if EXIST "%~dp0build\" rd /s /q "%~dp0build\"
mkdir "%~dp0build\"

for /D %%D in ("*.theme") do (
	echo Building theme package %%D...
 	zip -0 -j .\Build\%%D %%D\* > NUL
)

for /D %%D in ("*.webfolder") do (

	echo Building web folder package %%D...

	pushd %%D
	for /r %%F in ("*.bat") do (
		pushd .
		echo Invoking %%F...
		call %%F --always-make
		popd
	)
	for /r %%F in ("*.make") do (
		echo Invoking %%F...
		make --always-make --file=%%F
	)

	zip -9 -r ..\Build\%%D * -x *.bat *.make *.git* *node_modules*
	popd
)

echo.