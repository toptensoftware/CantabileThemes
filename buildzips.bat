if "%1"=="" (
	set TARGETDIR=Build
) ELSE (
	set TARGETDIR=%1
)

if not exist %TARGETDIR% mkdir %TARGETDIR%

for /D %%D in ("*.theme") do (
	if exist .\%TARGETDIR%\%%D del .\PackagedThemes\%%D.zip
	zip -0 -j .\%TARGETDIR%\%%D %%D\*
)