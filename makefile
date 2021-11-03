all: assets knobs zip

assets: Dark.cantabileTheme/Plugin.png

knobs: Dark.cantabileTheme/Knob.png Dark.cantabileTheme/Knob_focused.png

zip: build/Dark.cantabileTheme build/Light.cantabileTheme

clean:
	@rm -rf build temp
	@rm -f Dark.cantabileTheme/*.png

Dark.cantabileTheme/Plugin.png: Dark.svg
	@echo "Exporting assets..."
	@inkscape-export Dark.svg --scale:1 --scale:2 --scale:4 --quiet --out:Dark.cantabileTheme

build/Dark.cantabileTheme: Dark.cantabileTheme/*
	@echo "Zipping Dark theme..."
	@mkdir -p ./build
	@zip -0 -j ./build/Dark.cantabileTheme Dark.cantabileTheme/* > /dev/null

build/Light.cantabileTheme: Light.cantabileTheme/*
	@echo "Zipping Light theme..."
	@mkdir -p ./build
	@zip -0 -j ./build/Light.cantabileTheme Light.cantabileTheme/* > /dev/null

Dark.cantabileTheme/Knob.png: Knob.svg
	@echo "Exporting Knob (normal)..."
	@inkscape-export Knob.svg --scale:1 --scale:2 --scale:4 --out:temp --quiet
	@magick montage `ls temp/Knob_??.png` -tile 8x8 -background transparent -geometry +0+0 Dark.cantabileTheme/Knob.png
	@magick montage `ls temp/Knob_??@2x.png` -tile 8x8 -background transparent -geometry +0+0 Dark.cantabileTheme/Knob@2x.png
	@magick montage `ls temp/Knob_??@4x.png` -tile 8x8 -background transparent -geometry +0+0 Dark.cantabileTheme/Knob@4x.png
	@rm -rf temp

Dark.cantabileTheme/Knob_focused.png: Knob_focused.svg
	@echo "Exporting Knob (focused)..."
	@inkscape-export Knob_focused.svg --scale:1 --scale:2 --scale:4 --out:temp --quiet
	@magick montage `ls temp/Knob_??.png` -tile 8x8 -background transparent -geometry +0+0 Dark.cantabileTheme/Knob_focused.png
	@magick montage `ls temp/Knob_??@2x.png` -tile 8x8 -background transparent -geometry +0+0 Dark.cantabileTheme/Knob_focused@2x.png
	@magick montage `ls temp/Knob_??@4x.png` -tile 8x8 -background transparent -geometry +0+0 Dark.cantabileTheme/Knob_focused@4x.png
	@rm -rf temp
