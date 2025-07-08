all: pjs.pdf

pjs.pdf: README.rst
	pandoc README.rst -o pjs.pdf

