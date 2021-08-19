all: assets zip

assets: Cantabile.Gui.Dark.theme/LedSmallOff.png

zip: build/Cantabile.Gui.Dark.theme

clean:
	rm build/Cantabile.Gui.Dark.theme Cantabile.Gui.Dark.theme/*.png

Cantabile.Gui.Dark.theme/LedSmallOff.png: Dark.svg
	@echo "[ EXPORT ] Dark"
	@inkscape-export Dark.svg --scale:1 --scale:2 --scale:4 --quiet --transparent:#333333 --out:Cantabile.Gui.Dark.theme

build/Cantabile.Gui.Dark.theme: Cantabile.Gui.Dark.theme/theme.gt Cantabile.Gui.Dark.theme/LedSmallOff.png
	@echo "[  ZIP   ] Dark"
	@mkdir -p ./build
	@zip -0 -j ./build/Cantabile.Gui.Dark.theme Cantabile.Gui.Dark.theme/* > /dev/null
