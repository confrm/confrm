Installation
============

The Confrm server is best installed and maintained using the provided Docker image, however it can also be run on a native system. This section covers running the server in both configurations.

Storage
-------

The Confrm server will require somewhere to store the database and package files, and the port it runs on will need to be opened on any firewalls in order for nodes to connect to it.

... Add in some recommendations on where to store data

Docker Installation/Upgrade
---------------------------

Follow the general installation instructions for Docker on your choice of host system. The docker daemon should be configured to start on reboot.

In order to get the most recent release do::

  docker pull confrm/confrm:latest

Assuming your file store is /var/confrm, you can start the Confrm server using::

  docker run -d --restart=always -v /var/confrm::/confrm -p 8000:80 -name confrm confrm/confrm:latest

This will expose port 8000 on the container as port 80 on the host, to use port 80 on the host use -p 80:80.

Now navigate to http://localhost:8000 to get to the dashboard.

To upgrade an existing container stop the confrm server with::

  docker stop confrm

Backup the data folder (for example cd /var/confrm, tar cvzf ~/confrm_backup.tar.gz ./\*) and then rename the old docker image::

  docker rename confrm confrm_backup

Create a new container as before, and check the server is working. It is best to keep the backups until the next upgrade.

If you need to restore a backup, stop the docker container as before and make a copy of the broken files (for example cd /var/confrm, tar cvzf ~/confrm_backup_broken.tar.gz ./\*) and then delete the data files and restore the old backup::

  cd /var/confrm
  rm ./*
  tar xvzf ~/confrm_backup.tar.gz

Then delete the new docker container and restore the old docker container using::

  docker delete confrm
  docker rename confrm_backup confrm
  docker start confrm

If you are having issues with an upgrade please consider raising a ticket on the github project page.

Native Installation
-------------------

The Confrm server is packaged as a python library, there are two options to installing the library - either from the github repository or via pypi. Using the github repository will enable access to the develop and upstream branches, if present.

Note that sudo is used to install the package for all users, this will enable autostart scripts to access the software - if you only wish to run the server as your user you do not need to use sudo, but will need to add --user after `pip install`.

To install with pypi using pip::

  sudo pip install confrm

To install from github using pip::

  sudo pip install git+https://github.com/confrm/confrm.git

To install a specific branch using pip (i.e. develop)::

  sudo pip install git+https://github.com/confrm/confrm.git@develop

To upgrade an installed package use::

  sudo pip install [source] --upgrade

Where [source] is the selected source.

Confrm requires a configuration file, for example (config.toml)

.. literalinclude:: ../../default/config.toml

The settings can be configured as required for your installation.

