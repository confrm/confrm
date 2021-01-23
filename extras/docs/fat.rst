Factory Acceptance Test
=======================

The Factory Acceptance Test must be completed before each release, it is there to ensure that the system functions correctly given relatively real world inputs.

Ideally any problems with confrm will be described in the context of the FAT in order to provide a controlled and reproducible environment.

Setup
-----

Four programs need to be build, with different permutations as described:

=============  ====================  =======
Package Name   Permutation           Version
=============  ====================  =======
flasher        reset config enabled  
flasher        fast flashing         1.0.0
flasher        medium flashing       1.0.1
flasher        slow flashing         1.0.2
config_getter                        0.1.0
sos                                  1.0.2
=============  ====================  =======

At least two identical ESP32 devices are required. It is useful to know the MAC address of each of the devices.

The programs should be configured to connect to the wifi and use the latest confrm-esp32-arduino library.

The "flasher" program will flash an LED at a detectable fast/medium/slow speed.

The "config_getter" program will flash the LED at a speed determined by a configuration stored on the confrm server. The program is set to check periodically (few seconds) for updates.

The "sos" program will flash the LED in an "SOS" sequence.


Serial 1 - Node Detection
-------------------------

Program all ESP32 devices with the reset config version of flasher.

Check that all nodes show up in the nodes screen, give each node an identifiable title.

This serial passes if all nodes are detected and displayed correctly (package is "flasher") and if the titles are correctly applied.


Serial 2 - Package Update
-------------------------

On the packages screen create a new package called "flasher" with a title of "Flasher", description of "LED Flasher" and platform of "esp32".

Upload a new package version for flasher, being the flasher_fast binary with version 1.0.0. Set the deployment  strategy as "Immediate".

Once uploaded ensure that all ESP32 devices have updated to the new version using the nodes screen.

This serial passes if the nodes are updated to flasher version 1.0.0 and the LED starts flashing fast.


Serial 3 - Package Deployments
------------------------------

On the package screen upload a new package version for the flasher, being the flasher_medium binary with version 1.0.1. Set the deployment strategy to "Upload Only".

Confirm that none of the ESP32's have been updated using the node screen and by observing the LED flash speed.

On the package screen upload a new package version for the flasher, being the flasher_slow binary with version 1.0.2. Set the deployment strategy to "Canary" and select one of the nodes from the drop down list.

Confirm that only that node updates using the node screen and by observing the LED flash speed.

On the package screen, click on the "Action" button for the package and select "Manage Versions" and promote version 1.0.2 to the active version and delete version 1.0.0 from the system.

Confirm that all nodes are on the slow flash permutation using the node screen and by observing the LED flash speed.

This serial passes if the updates occur as expected, and that version 1.0.0 is deleted.


Serial 4 - Node Package Change
------------------------------

On the package screen create a new package called "config_getter" with the title "Config Getter", description of "Gets configs from confrm server" and platform "esp32".

Upload the binary for that package as version 0.1.0 and set the deployment strategy as "Immediate".

On the nodes screen, press the "Action" button for one of the nodes and change package from "Flasher" to "Config Getter".

Confirm that the information in the nodes tab reflects the change of package.

Change at least one other node to use the "Config Getter" package.

This serial passes if the update occurs as expected.


Serial 5 - Setting Configurations
---------------------------------

In the configuration screen click on "Add new config", select global and create a configuration called "flash_time" and set it to 25.

Confirm that the nodes set to use the "Config Getter" package start flashing.

In the configuration screen click on "Add new config", select package and create a configuration for the "Config Getter" package called "flash_time" and set the value to 10.

Confirm that the nodes set to use the "Config Getter" package start flashing faster.

In the configuration screen click on "Add new config", select node and create a configuration for one of the nodes using the "Config Getter" package called "flash_time" and set the value to 200.

Confirm that the one node selected starts flashing slower.

In the configuration screen click on "Actions" next to the global config for "flash_time" and edit the value to 200.

Confirm that no change occurs.

Using the actions menu delete the node config set previously and confirm that node goes back to the fast flashing.

Using the actions menu delete the package config set previously and confirm that all nodes set to run "Config Getter" start flashing very slowly.

This serial is complete if the nodes operate as expected with the "Config Getter" program.

Serial 6 - Package change to same version
-----------------------------------------

This serial is to test changing packages on a node when the package version is the same (i.e. the force update feature).

