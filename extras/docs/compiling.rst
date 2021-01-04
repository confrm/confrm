Compiling
=========

Confrm is built as a python library, and once installed adds confrm\_srv as an executable to the host system path.

Confrm does not need to be compile and confrm\_srv can be run from the project root directory.

Unit tests are run using, run `pytest` in the project root directory, or the test directroy.

Documentation is built using doxygen and sphinx, and configured to be integrated with readthedocs. In order to build locally run::

  cd extras/docs
  doxygen
  sphinx-build -b html ./ _build/html

The documentation will be built using a basic template in `extras/docs/_build/html`.


