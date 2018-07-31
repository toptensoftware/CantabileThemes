cantabile-js.js: ../../cantabile-js/www/*.js
	cd ../../cantabile-js && make
	cp ../../cantabile-js/www/* .
