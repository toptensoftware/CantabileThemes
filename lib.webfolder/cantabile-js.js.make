cantabile-js.js: ../../cantabile-js/*.js
	browserify --standalone Cantabile -o cantabile-js.js ../../cantabile-js/CantabileApi.js
	uglifyjs -o cantabile-js.min.js cantabile-js.js
