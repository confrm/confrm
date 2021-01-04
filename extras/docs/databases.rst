Databases
=========

Confrm uses the TinyDB database engine, the following tables are present:

====================   ==================================================================
Name                   Description
====================   ==================================================================
packages               Main package database
package\_versions      Package blob repository
nodes                  Stores node access information on nodes, including canary data
config                 Stores configs for global/package/nodes
====================   ==================================================================

Packages
________

Packages data fields are:

====================   ==================================================================
Name                   Description
====================   ==================================================================
name                   Package name, \[A-Za-Z0-9_-\] only
title                  Text name, friendly for humans
description            Text description
platform               Platform type (ESP32 etc.)
current_version        Current version in major.minor.revision format
====================   ==================================================================

The versions for a given package can be found by searching in the package versions table against the 'name' field.

Package Versions
________________

====================   ==================================================================
Name                   Description
====================   ==================================================================
name                   Package Name
major                  Major version number
minor                  Minor version number
revision               Revision number
date                   64-bit Unix timestamp of date added
blob\_id               ID of blob in the data store
hash                   SHA256 of the blob
====================   ==================================================================

Nodes
_____

====================   ==================================================================
Name                   Description
====================   ==================================================================
node                   Unique node identifier
package                Package installed
version                Current version of package installed
last\_seen             Time last seen
last\_updated          Time last updated
description            Node produced description of node
platform               Currently configured platform
ip\_address            FastAPI inferred ip address
canary (optional)      Contains canary configuration if used
====================   ==================================================================

Config
______

====================   ==================================================================
Name                   Description
====================   ==================================================================
type                   Config type [GLOBAL, PACKAGE, NODE]
id                     Package name or node id, or empty as appropriate
key                    Key of the config
value                  Value of the config
====================   ==================================================================

----
