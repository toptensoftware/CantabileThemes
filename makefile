all: assets knobs zip

assets: Cantabile.Gui.Dark.theme/LedSmallOff.png

knobs: Cantabile.Gui.Dark.theme/Knob.png Cantabile.Gui.Dark.theme/Knob_focused.png

zip: build/Cantabile.Gui.Dark.theme

clean:
	@rm -rf build temp
	@rm -f Cantabile.Gui.Dark.theme/*.png

Cantabile.Gui.Dark.theme/LedSmallOff.png: Dark.svg
	@echo "Exporting assets..."
	@inkscape-export Dark.svg --scale:1 --scale:2 --scale:4 --quiet --out:Cantabile.Gui.Dark.theme

build/Cantabile.Gui.Dark.theme: Cantabile.Gui.Dark.theme/theme.gt Cantabile.Gui.Dark.theme/LedSmallOff.png
	@echo "Zipping theme..."
	@mkdir -p ./build
	@zip -0 -j ./build/Cantabile.Gui.Dark.theme Cantabile.Gui.Dark.theme/* > /dev/null

Cantabile.Gui.Dark.theme/Knob.png: Knob.svg
	@echo "Exporting Knob (normal)..."
	@inkscape-export Knob.svg --scale:1 --scale:2 --scale:4 --out:temp --quiet
	@magick montage `ls temp/Knob_??.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Gui.Dark.theme/Knob.png
	@magick montage `ls temp/Knob_??@2x.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Gui.Dark.theme/Knob@2x.png
	@magick montage `ls temp/Knob_??@4x.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Gui.Dark.theme/Knob@4x.png

Cantabile.Gui.Dark.theme/Knob_focused.png: Knob.svg
	@echo "Exporting Knob (focused)..."
	@inkscape-export Knob_focused.svg --scale:1 --scale:2 --scale:4 --out:temp --quiet
	@magick montage `ls temp/Knob_??.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Gui.Dark.theme/Knob_focused.png
	@magick montage `ls temp/Knob_??@2x.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Gui.Dark.theme/Knob_focused@2x.png
	@magick montage `ls temp/Knob_??@4x.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Gui.Dark.theme/Knob_focused@4x.png
	