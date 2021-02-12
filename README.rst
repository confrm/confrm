Confrm
======

.. image:: https://github.com/confrm/confrm/workflows/Test/Deploy/badge.svg

Confrm is an application designed to make it easy to deploy IOT type applications across your network.

It uses a Python based server to host application binaries, which connected IOT devices can poll for updates and configuration information.

Go to https://confrm.io/ to find quickstart guides and https://confrm.readthedocs.org/ for more detailed documentation.

Currently supported platforms are:

* ESP32, ESP8266 - https://github.com/confrm/confrm-arduino-esp/

To build and run the sever as a service on a raspberry pi::

  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh ./get_docker.sh

  sudo usermod -aG docker pi

Reboot so the docker permissions are set to the user, then::

  sudo mkdir /var/local/confrm && chmod a+rw /var/local/confrm

  docker run -d --restart=always -v /var/local/confrm:/confrm -p 8000:80 --name confrm confrm/confrm:latest

And then navigate to http://[pi]:8000.


----

