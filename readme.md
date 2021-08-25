# Cantabile Themes

This repository holds the default Cantabile theme files and source assets.


## Building

In order to build and package the theme files, you'll need:

 * Inkscape installed in the default location
 * ImageMagick installed an available on the system path
 * Export utility `inkscape-export`, available here: https://www.npmjs.com/package/inkscape-export 
 * Linux line command line utils `make`, `zip` and `mkdir` (eg: git commands, or cygwin)

 To run the build, from the this directory just run `make`.

 
## VS Code Extension

Included in this repository is a VS Code extension that provides syntax highlighting for the .gtl 
files that are used in authoring Cantabile themes.

To install the extension:

1. Download the extension package [guikit-theme-language-support-0.0.1.vsix](https://bitbucket.org/toptensoftware/cantabilethemes/raw/TechUpdate2021/guikit-theme-language-support-0.0.1.vsix)
2. Start VS Code
3. Open the Extensions panel on the left.
4. Click the '...' button at the top right of the extensions panel
5. Choose "Install from VSIX"
6. Locate the downloaded file and choose OK.

Once installed, loading .gtl files into VS Code will have syntax highlighting applied.


