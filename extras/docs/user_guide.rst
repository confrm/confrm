User Guide
==========

Assuming you have a running confrm server, next you need to add the confrm node features to your hardware nodes:

 * ESP32

Nodes are loaded with a version of a pacakge. A package might contain the generic code for temperature sensors, and using confrm each node can be assigned a configuration.

During comissioning a new node will show up in the nodes tab, it can then be assigned a name (such as "Living room sensor") and assigned a configuration (for example "mqtt_topic" = "living\_room\_sensor").

The node software will regularly check back with the confrm server to see if there are updates - if there are it will perform and over-the-air update and reboot.

Nomenclature
------------

====================   ==================================================================
Name                   Description
====================   ==================================================================
Server                 Application running on the network, accessible to all nodes via
                       their network connection
Node                   Individual device on the network (for example an ESP32 module)
Package                The name of the application running on the node, includes some
                       meta-data about the package
Version                Blob of data and meta-data which constitutes a version of the
                       Package which runs on a node
====================   ==================================================================

Adding a new package
--------------------

Navigate to the packages screen using the navigation menu, click the "Add Package" button on the top right.

The form will allows you to enter the following fields:

====================   ==================================================================
Name                   Description
====================   ==================================================================
Name                   Package name, must be unique and contain only the characters 
                       a-zA-Z0-9_-. This is the package name used by nodes to look for 
                       updates.
Title                  A more descriptive title for the package, if left blank it will be
                       filled with the package name.
Description            Description of package - can be blank.
Platform               Platform specific platform identifier, for example esp32. This is
                       used to select the correct method for over the air updates. Can
                       be blank.
====================   ==================================================================

For packages which have implementations for multiple platforms the names must be unique, so temp\_sensor\_esp32 and temp\_sensor\_esp8622 would be a sensible naming convention - but it is up to you!

Packages cannot be renamed once they have been created, the title, description and platform can be changed.

Adding a new package version
----------------------------

Follow the platform specific instructions to generate a binary file of the package.

Navigate to the packages screen using the navigation menu, on the row for the package click on "Actions" and select "Upload new version".

The form allows you to enter the following fields:

====================   ==================================================================
Name                   Description
====================   ==================================================================
Version Number         Version number in major, minor, revision format.
File                   Select the binary file to be uploaded.
Deployment Strategy    Immediate/Canary/None. See bellow.
====================   ==================================================================

The version number must be positive integer numbers, ideally an increment on the previous version.

The deployment strategy specifies how nodes are updated.

The `immediate` strategy will set the new package version as active and update all nodes the next time they check for updates.

The `canary` strategy enables you to nominate a single node to get updated the next time it checks for updates. This is useful if making large changes you wish to test on an easy to un-brick node. Once you are sure this version of the software works you need to use the package screen to set the new package version as active in order to update all remaining nodes.

The `none` option will create the new version, but will not set it to active.

Configurations
--------------

Configurations are key-value pairs stored in confrm which can be queried by nodes. There are three types of config:

* Global
* Package
* Node

Key names can override existing key names in decreasing scope. So a key called `mqtt\_server` set as global would be overridden if it was set for a package, and that could be overridden if it was set for a specific node.

This enables a level of standardisation between nodes, but also allows for a high degree of customisation if desired.
