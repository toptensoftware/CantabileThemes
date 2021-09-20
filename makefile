all: assets knobs zip

assets: Cantabile.Dark.theme/LedSmallOff.png

knobs: Cantabile.Dark.theme/Knob.png Cantabile.Dark.theme/Knob_focused.png

zip: build/Cantabile.Dark.theme

clean:
	@rm -rf build temp
	@rm -f Cantabile.Dark.theme/*.png

Cantabile.Dark.theme/LedSmallOff.png: Dark.svg
	@echo "Exporting assets..."
	@inkscape-export Dark.svg --scale:1 --scale:2 --scale:4 --quiet --out:Cantabile.Dark.theme

build/Cantabile.Dark.theme: Cantabile.Dark.theme/main.gtl Cantabile.Dark.theme/LedSmallOff.png
	@echo "Zipping theme..."
	@mkdir -p ./build
	@zip -0 -j ./build/Cantabile.Dark.theme Cantabile.Dark.theme/* > /dev/null

Cantabile.Dark.theme/Knob.png: Knob.svg
	@echo "Exporting Knob (normal)..."
	@inkscape-export Knob.svg --scale:1 --scale:2 --scale:4 --out:temp --quiet
	@magick montage `ls temp/Knob_??.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Dark.theme/Knob.png
	@magick montage `ls temp/Knob_??@2x.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Dark.theme/Knob@2x.png
	@magick montage `ls temp/Knob_??@4x.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Dark.theme/Knob@4x.png

Cantabile.Dark.theme/Knob_focused.png: Knob.svg
	@echo "Exporting Knob (focused)..."
	@inkscape-export Knob_focused.svg --scale:1 --scale:2 --scale:4 --out:temp --quiet
	@magick montage `ls temp/Knob_??.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Dark.theme/Knob_focused.png
	@magick montage `ls temp/Knob_??@2x.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Dark.theme/Knob_focused@2x.png
	@magick montage `ls temp/Knob_??@4x.png` -tile 8x8 -background transparent -geometry +0+0 Cantabile.Dark.theme/Knob_focused@4x.png
	