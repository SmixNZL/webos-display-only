.PHONY: check
check:
	python3 -B -m unittest discover -s tests -v
	node --check tv/engine.js
	node --check tv/probe.js
	node --check tv/fullhome.js
	node tests/test_fullhome.js
	node tests/test_prepare.js
	sh -n tv/runtime.sh
	sh -n tv/local-only.sh
