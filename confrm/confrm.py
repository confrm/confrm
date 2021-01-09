"""Main FastAPI Implementation of confrm

Copyright 2020 confrm.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Codes:

    000 ERROR    -           -                       Package not found
    001 ERROR    -           -                       Node not found
    002 ERROR
    003 ERROR    PUT         /package/               Package already exists
    004 ERROR    PUT         /package/               Package name cannot be empty
    005 ERROR    PUT         /register_node/         Node id is invalid
    006 ERROR    PUT         /package_version/       Version already exists for package
    007
    008 ERROR    PUT         /node_package/          Package has no active version
    009
    010 ERROR    PUT         /package/               Package name does not match pattern
    011 ERROR    GET         /check_for_update/      No versions found for package
    012 ERROR    GET         /config/                Key not found
    013
    014
    015
    016 ERROR    PUT         /config/                Key name does not match pattern
    017 ERROR    POST        /package_version/       Version numbers cannot be negative
    018 ERROR    PUT         /node_package/          Package version not found
    019
    020 ERROR    DELETE      /package_version/       Package version not found
    021 WARNING  DELETE      /package_version/       Active version not set
    022 ERROR    PUT         /node_title/            Node does not exist
    023 ERROR    PUT         /node_title/            Node title is too long
    024 ERROR    DELETE      /config/                Key not found
    025 
    026 ERROR    POST        /package_version/       Canary node not found
    027
    028
    029

"""

import base64
import datetime
import logging
import os
import re
import time
import uuid

from copy import deepcopy

import toml

from Crypto.Hash import SHA256
from fastapi import FastAPI, File, Depends, Response, Request, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from tinydb import TinyDB, Query
from tinydb.operations import delete
from markupsafe import escape
from pydantic import BaseModel  # pylint: disable=E0611

from confrm.responses import ConfrmFileResponse
from confrm.zeroconf import ConfrmZeroconf

logger = logging.getLogger('confrm')
logger.setLevel(logging.INFO)


# pydantic data models are used to describe the inputs for the various REST
# API calls, if the calls do not match these names and data-types then the call
# to FastAPI will fail


class Package(BaseModel):  # pylint: disable=R0903
    """Definition of a package"""
    name: str
    title: str
    description: str
    platform: str


class PackageVersion(BaseModel):  # pylint: disable=R0903
    """Definition of a package version"""
    name: str
    major: int
    minor: int
    revision: int


APP = FastAPI()
CONFIG = None
DB = None
ZEROCONF = ConfrmZeroconf()


def do_config():
    """Gets the config based on an environment variable and sets up global
    objects as required """

    global CONFIG, DB  # pylint: disable=W0603

    if "CONFRM_CONFIG" not in os.environ.keys():
        msg = "CONFRM_CONFIG not set in os.environ"
        logging.error(msg)
        raise ValueError(msg)

    config_file = os.environ["CONFRM_CONFIG"]

    if os.path.isfile(config_file) is False:
        msg = f"Config file {config_file} does not exist"
        logging.error(msg)
        raise ValueError(msg)

    CONFIG = toml.load(config_file)

    # Create the database from the data store
    DB = TinyDB(os.path.join(CONFIG["storage"]["data_dir"], "confrm_db.json"))


def get_package_versions(name: str, package: {} = None):
    """Handles the version ordering logic

    Versions are sorted to be in descending order, with the currently
    active version at the top of the list (position 0)

    Attributes:
        name (str): package name string
        package ({}): [Optional] package dict, saves looking up the entry again
    """

    query = Query()

    if package is None:
        package = DB.table("packages").search(query.name == name)

    package_versions = DB.table("package_versions")
    versions_raw = package_versions.search(query.name == name)

    versions = []
    current_version = None
    for entry in versions_raw:

        date_str = ""
        if entry["date"] <= 0:
            date_str = "Unknown"
        else:
            date_str = datetime.datetime.fromtimestamp(entry["date"])

        version_str = f'{entry["major"]}.{entry["minor"]}.{entry["revision"]}'
        if "current_version" in package.keys() and \
                version_str == package["current_version"]:
            current_version = {
                "number": version_str,
                "date": date_str,
                "blob": entry["blob_id"]
            }
        else:
            versions.append({
                "number": version_str,
                "date": date_str,
                "blob": entry["blob_id"]
            })
            versions = sorted(
                versions,
                key=lambda x: [int(i) if i.isdigit()
                               else i for i in x["number"].split('.')],
                reverse=True
            )

    if current_version is not None:
        versions.insert(0, current_version)

    return versions


def format_package_info(package: dict, lite: bool = False):
    """Formats data in to correct dict form

    Can generate long form (for UI) or short form  / lite (for nodes)

    Attributes:
        package (dict): package dict from DB
        lite (bool): if true a reduced response is generated
    """

    current_version = ""
    if "current_version" in package.keys():
        current_version = package["current_version"]

    # Minimal data for lite implementation
    if lite:
        return {
            "current_version": current_version,
        }

    versions = get_package_versions(package["name"], package)

    latest_version = current_version
    if len(versions) > 0:
        latest_version = max(versions, key=lambda x: x["date"])["number"]

    return {
        "name": package["name"],
        "title": package["title"],
        "description": package["description"],
        "platform": package["platform"],
        "current_version": current_version,
        "latest_version": latest_version,
        "versions": versions
    }


def get_package_version_by_version_string(package_name: str, version: str):
    """Get package version using string name and string version number"""

    package_versions = DB.table("package_versions")
    query = Query()
    parts = version.split(".")
    return package_versions.get(
        (query.name == package_name) &
        (query.major == int(parts[0])) &
        (query.minor == int(parts[1])) &
        (query.revision == int(parts[2])))


def sort_configs(configs):  # pylint: disable=R0912
    """Sort configs by global/package/node, then by package name, then by node name

    Attributes:
        configs (list): List of config dicts
    """

    result = []

    # Find all unique keys and sort alphabetically
    _keys = []
    for config in configs:
        if config["key"] not in _keys:
            _keys.append(config["key"])
    _keys = sorted(_keys, key=str.lower)

    # For each key find globals, then packages, then nodes
    for key in _keys:
        _packages = []
        _nodes = []
        for config in configs:
            if config["key"] == key:
                if config["type"] == "global":
                    result.append(config)
                elif config["type"] == "package":
                    _packages.append(config)
                elif config["type"] == "node":
                    _nodes.append(config)

        # Sort the package end node elements alphabetically
        _package_ids = sorted([_package["id"]
                               for _package in _packages], key=str.lower)
        for package in _package_ids:
            for config in configs:
                if config["key"] == key and config["type"] == "package" and config["id"] == package:
                    result.append(config)
                    break

        _node_ids = sorted([_node["id"] for _node in _nodes], key=str.lower)
        for node in _node_ids:
            for config in configs:
                if config["key"] == key and config["type"] == "node" and config["id"] == node:
                    result.append(config)
                    break

    return result


def set_canary(node_id: str, package: str, version: str):
    """Creates an entry in the canary table for this node.

    If the node already exists then the previous entry will be deleted, and if an entry
    for the package already exists then that will be deleted.

    There can only be one entry per package and per node.

    Attributes:
        node_id (str): Node_id to be added
        package (str): Package name which the node will be set to
        version (str): Version of package the node will be set to
    """

    query = Query()
    canaries = DB.table("canary")

    # Check for existing node entry and delete if it exists
    canary_list = canaries.search(query.node_id == node_id)
    for canary in canary_list:
        canaries.remote(doc_ids=[canary.doc_id])

    # Check for existing entries for the given package, delete if exists
    packages_list = canaries.search(query.package == package)
    for package_doc in packages_list:
        canaries.remote(doc_ids=[package_doc.doc_id])

    # Insert new entry, force is set to True, once the node has been updated
    canaries.insert({
        "package": package,
        "version": version,
        "node_id": node_id,
        "force": True
    })


def remove_canary(package: str = "", node_id: str = ""):
    """Removes the given package or node canary entry

    Exceptions:
        ValueError("Canary Not Found")

    Attributes:
        node_id (str): Node_id to be added
        package (str): Package name which the node will be set to
    """

    if not package and not node_id:
        raise ValueError("Canary Not Found")

    query = Query()
    canaries = DB.table("canary")

    remove_count = 0

    if package:
        package_canaries = canaries.search(query.package == package)
        remove_count += len(package_canaries)
        for package_doc in package_canaries:
            canaries.remove(doc_ids=[package_doc.doc_id])

    if node_id:
        node_canaries = canaries.search(query.node_id == node_id)
        remove_count += len(node_canaries)
        for node_doc in node_canaries:
            canaries.remove(doc_ids=[node_doc.doc_id])

    if remove_count == 0:
        raise ValueError("Canary Not Found")


def get_canary(package: str = "", node_id: str = ""):
    """Checks if a canary exists for given package or node_id

    Exceptions:
        ValueError("Input Not Set")

    Attributes:
        node_id (str): Node_id to be added
        package (str): Package name which the node will be set to

    Returns:
        None: No entry found
        TinyDB Document: Found entry
    """

    if not package and not node_id:
        raise ValueError("Input Not Set")

    query = Query()
    canaries = DB.table("canary")

    if package:
        package_doc = canaries.get(query.package == package)
        if package_doc is not None:
            return package_doc

    if node_id:
        node_doc = canaries.get(query.node_id == node_id)
        if node_doc is not None:
            return node_doc

    return None


def package_exists(package: str):
    """ Checks if package exists, returns tuple of (package_doc, status, error_dict)

    Attributes:
        packages (str): Package to search for
    """
    query = Query()
    packages = DB.table("packages")

    package_doc = packages.get(query.name == package)
    if package_doc is None:
        msg = "Package not found"
        return (None, status.HTTP_404_NOT_FOUND,{
            "error": "confrm-000",
            "message": msg,
            "detail": "The package specified was not found"
        })
    return (package_doc, None, None)


def node_exists(node_id: str):
    """ Checks if node exists, returns tuple of (node_doc, status, error_dict)

    Attributes:
        packages (str): Package to search for
    """
    query = Query()
    nodes = DB.table("nodes")

    node_doc = nodes.get(query.node_id == node_id)
    if node_doc is None:
        msg = "Node not found"
        return (None, status.HTTP_404_NOT_FOUND,{
            "error": "confrm-001",
            "message": msg,
            "detail": "The node specified was not found"
        })
    return (node_doc, None, None)


# Files server in /static will point to ./dashboard (with respect to the running
# script)
APP.mount("/static",
          StaticFiles(directory=os.path.join(os.path.dirname(__file__), "dashboard")
                      ),
          name="home")


@APP.on_event("startup")
async def startup_event():
    """Is called on application startup"""

    do_config()


@APP.on_event("shutdown")
async def shutdown_event():
    """Is called on application shutdown"""

    ZEROCONF.close()


@APP.get("/")
async def index():
    """Returns index page for UI"""
    return FileResponse(
        os.path.join(os.path.dirname(__file__), "dashboard/index.html")
    )


@APP.get("/info/")
async def info():
    """Get basic info for UI elements"""

    ret = {}

    packages = DB.table("packages")
    ret["packages"] = len(packages)

    nodes = DB.table("nodes")
    ret["nodes"] = len(nodes)

    return ret


@APP.get("/time/")
async def get_time():
    """Returns time of day from server as unix epoch time"""
    if CONFIG is None:
        do_config()

    return {"time": round(time.time())}


@APP.get("/canary/", status_code=status.HTTP_200_OK)
async def get_canary_api(response: Response, node_id: str = ""):
    """Helper to read back the canary status for a node

    Attributes:
        node_id (str): The node id to check against
        response (Response): Starlette response object for setting return codes
    """

    canary = get_canary(node_id = node_id)
    if canary is None:
        msg = "Canary entry not found"
        logging.info(msg)
        response.status_code = status.HTTP_404_NOT_FOUND
        return {
            "error": "confrm-022",
            "message": msg,
            "detail": msg
        }

    return canary


@APP.put("/register_node/", status_code=status.HTTP_200_OK)
async def register_node(  # pylint: disable=R0913
        node_id: str,
        package: str,
        version: str,
        description: str,
        platform: str,
        request: Request,
        response: Response):
    """Registers a node to the server

    Attributes:
        node_id (str): The node id, must be unique, MAC addresses work well
        package (str): Package installed on the node
        version (str): Version string of currently running package
        description (str): Description of package
        platform: (str): Platform type (i.e. esp32)
        request (Request): Starlette request object for getting client information
        response (Response): Starlette response object for setting return codes

    Returns:
        HTTP_200_OK
        HTTP_404_NOT_FOUND
    """

    query = Query()
    nodes = DB.table("nodes")

    # Make sure input is sane
    node_id = escape(node_id)
    package = escape(package)
    version = escape(version)
    description = escape(description)
    platform = escape(platform)

    # Asterisk is not allowed!
    if node_id == "*":
        msg = "Node id is invalid"
        logging.info(msg)
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "error": "confrm-005",
            "message": msg,
            "detail": "A node attempted to register with an invalid node_id"
        }


    (package_doc, status_code, err) = package_exists(package)
    if package_doc is None:
        response.status_code = status_code
        return err

    node_doc = nodes.get(query.node_id == node_id)
    if node_doc is None:
        entry = {
            "node_id": node_id,
            "title": node_id,
            "package": package,
            "version": version,
            "description": description,
            "platform": platform,
            "last_updated": -1,
            "last_seen": round(time.time()),
            "ip_address": request.client.host
        }
        nodes.insert(entry)
        return {}

    # Update the package entry based on package name change, new version of a package
    # and register this as the last update time
    if node_doc["package"] != package:  # Package changed
        node_doc["package"] = package
        node_doc["version"] = version
        node_doc["last_updated"] = -1
    elif node_doc["version"] != version:  # Version of package changed
        node_doc["version"] = version
        node_doc["last_updated"] = round(time.time())
    node_doc["last_seen"] = round(time.time())

    node_doc["package"] = package
    node_doc["description"] = description
    node_doc["platform"] = platform
    node_doc["ip_address"] = request.client.host

    nodes.update(node_doc, query.node_id == node_id)

    # Check to see if a canary
    canary = get_canary(node_id=node_id)
    if canary is not None:
        canaries = DB.table("canary")
        canary["force"] = False
        canaries.update(canary, query.node_id == node_id)

    return {}


@APP.get("/nodes/", status_code=status.HTTP_200_OK)
async def get_nodes(package: str = "", node_id: str = ""):
    """Returns a list of nodes, if package is set the only return nodes using that package, if
    a node is set then return the doc for that node.

    Attributes:
        package (str): name of package to return node list for
    """

    query = Query()
    nodes = DB.table("nodes")

    node_list = []
    if package and node_id:
        node_list = nodes.search((query.package == package) &
                                 (query.node_id == node_id))
    elif package:
        node_list = nodes.search(query.package == package)
    elif node_id:
        node_list = nodes.search(query.node_id == node_id)
    else:
        node_list = nodes.all()

    if len(node_list) == 0:
        return {}

    # Make a new copy of list so we can make changes to elements for display layer without
    # changing the values in the database
    new_node_list = deepcopy(node_list)
    node_list = new_node_list

    for node in node_list:
        if node["last_updated"] != -1:
            value = datetime.datetime.fromtimestamp(node["last_updated"])
            node["last_updated"] = f"{value:%Y-%m-%d %H:%M:%S}"
        else:
            node["last_updated"] = "Unknown"
        if node["last_seen"] != -1:
            value = datetime.datetime.fromtimestamp(node["last_seen"])
            node["last_seen"] = f"{value:%Y-%m-%d %H:%M:%S}"
        else:
            node["last_seen"] = "Unknown"

    if not package and node_id:
        return node_list[0]
    return node_list


@APP.put("/node_title/", status_code=status.HTTP_200_OK)
async def put_node_title(response: Response, node_id: str = "", title: str = ""):
    """Sets the title of a node

    Attributes:
        package (str): name of package to return node list for
    """

    query = Query()
    nodes = DB.table("nodes")

    node_doc = nodes.get(query.node_id == node_id)
    if node_doc is None:
        msg = "Node does not exist"
        logging.info(msg)
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "error": "confrm-022",
            "message": msg,
            "detail": "While attempting to set the title of a node, the node id given was not"
            " found"
        }

    title = escape(title)

    if len(title) > 80:
        msg = "Node title is too long"
        logging.info(msg)
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "error": "confrm-023",
            "message": msg,
            "detail": "While attempting to set the title of a node, the title was too long"
        }

    nodes.update({"title": title}, query.node_id == node_id)
    return {}


@APP.get("/packages/")
async def package_list():
    """Get package list and process for displaying on the UI """
    if CONFIG is None:
        do_config()

    packages = DB.table("packages")

    # Packages contains a RAW list of packages, should process them down for
    # the UI - unique 'name' fields, with multiple 'versions'
    ui_packages = {}
    for package in packages:
        ui_packages[package["name"]] = format_package_info(package)

    return ui_packages


@APP.put("/package/", status_code=status.HTTP_201_CREATED)
async def put_package(response: Response, package: Package = Depends()):
    """Add package description

    Attributes:
        package (Package): Package description to be added
    """

    # Update storage record to include the local information
    package_dict = package.__dict__

    # Escape the strings
    for key in package_dict.keys():
        if isinstance(package_dict[key], str):
            package_dict[key] = escape(package_dict[key])

    if not package.name:
        msg = "Package name cannot be empty"
        logging.info(msg)
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "error": "confrm-004",
            "message": msg,
            "detail": "While attempting to add a new package the package name was set to \"\""
        }

    pattern = '^[0-9a-zA-Z_-]+$'
    regex = re.compile(pattern)

    if regex.match(package_dict["name"]) is None:
        msg = f"Package name does not match pattern {pattern}"
        logging.info(msg)
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "error": "confrm-010",
            "message": msg,
            "detail": "While attempting to add a new package the package name did not match the"
            f" pattern {pattern}"
        }

    if not package.title:
        package.title = package.name

    packages = DB.table("packages")
    query = Query()

    existing_name = packages.get(query.name == package_dict["name"])
    if existing_name is not None:
        msg = "Package already exists"
        logging.info(msg)
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "error": "confrm-003",
            "message": msg,
            "detail": "While attempting to add a new package to the database a package with this " +
            "name was found to already exist"
        }

    packages.insert(package_dict)

    return {}


@APP.delete("/package/", status_code=status.HTTP_200_OK)
async def delete_package(name: str, response: Response):
    """Delete a package, its versions and all configs

    Attributes:

        name (str): Package to be deleted
        response (Response): Starlette response object
    """

    query = Query()
    packages = DB.table("packages")
    package_versions = DB.table("package_versions")
    configs = DB.table("config")

    (package_doc, status_code, err) = package_exists(name)
    if package_doc is None:
        response.status_code = status_code
        return err

    # Get all the package versions associated with this package
    _versions = package_versions.search(query.name == name)
    for version in _versions:
        version_str = str(version["major"]) + "." + \
            str(version["minor"]) + "." + \
            str(version["revision"])
        await delete_package_version(name, version_str, response)

    # Get all the configs associated with this package
    _configs = configs.search((query.type == "package") &
                              (query.id == name))
    for config in _configs:
        await delete_config(key=config["key"], type="package", response=response, id=name)

    packages.remove(doc_ids=[package_doc.doc_id])

    return {}


@APP.post("/package_version/", status_code=status.HTTP_201_CREATED)
async def add_package_version(
        response: Response,
        package_version: PackageVersion = Depends(),
        set_active: bool = False,
        canary_next: bool = False,
        canary_id: str = "",
        file: bytes = File(...)):
    """Uploads a package version with binary package

    Arguments:
        response (Response): Starlette response object for setting return codes
        package_version (PackageVersion): Package description
        set_active (bool): Default False, if true this version will be set active
        file (bytes): File uploaded
    """

    package_version_dict = package_version.__dict__

    packages = DB.table("packages")
    package_versions = DB.table("package_versions")
    query = Query()

    (package_doc, status_code, err) = package_exists(package_version_dict["name"])
    if package_doc is None:
        response.status_code = status_code
        return err

    if canary_id:
        nodes = DB.table("nodes")
        node_doc = nodes.get(query.node_id == canary_id)
        if not node_doc:
            msg = "Node not found"
            logging.info(msg)
            response.status_code = status.HTTP_404_NOT_FOUND
            return {
                "error": "confrm-026",
                "message": msg,
                "detail": "While attempting to add a new package version the node " +
                " given was not found"
            }

    existing_version = package_versions.get((query.name == package_version_dict["name"]) &
                                            (query.major == package_version_dict["major"]) &
                                            (query.minor == package_version_dict["minor"]) &
                                            (query.revision == package_version_dict["revision"]))

    if existing_version is not None:
        msg = "Version already exists for package"
        logging.info(msg)
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "error": "confrm-006",
            "message": msg,
            "detail": "While attempting to add a new package version the version given " +
            " was found to be already used"
        }

    if package_version_dict["major"] < 0 or \
            package_version_dict["minor"] < 0 or \
            package_version_dict["revision"] < 0:
        msg = "Version number elements cannot be negative"
        logging.info(msg)
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "error": "confrm-017",
            "message": msg,
            "detail": "While attempting to add a new package version the version given " +
            " was found to contain negative numbers"
        }

    # Package was uploaded, create hash of binary
    _h = SHA256.new()
    _h.update(file)

    # Store the binary in the data_store as a base64 encoded file
    filename = uuid.uuid4().hex
    save_file = os.path.join(CONFIG["storage"]["data_dir"], filename)
    with open(save_file, "wb") as ptr:
        ptr.write(base64.b64encode(file))

    # Escape the strings
    for key in package_version_dict.keys():
        if isinstance(package_version_dict[key], str):
            package_version_dict[key] = escape(package_version_dict[key])

    # Update with blob details
    package_version_dict["date"] = round(time.time())
    package_version_dict["hash"] = _h.hexdigest()
    package_version_dict["blob_id"] = filename

    # Store in the database
    package_versions.insert(package_version_dict)

    version_str = str(package_version_dict["major"]) + "." + \
        str(package_version_dict["minor"]) + "." + \
        str(package_version_dict["revision"])

    if set_active is True:
        package_doc["current_version"] = version_str
        packages.update(package_doc, query.name == package_doc["name"])

    # If this is begin set to active, or a canary, delete existing canaries
    if set_active is True or canary_id:
        try:
            remove_canary(package=package_doc["name"])
        except ValueError as err:
            if str(err) != "Canary Not Found":
                raise

    if canary_id:
        set_canary(node_id=canary_id,
                   package=package_doc["name"],
                   version=version_str)

    return {}


@APP.delete("/package_version/", status_code=status.HTTP_200_OK)
async def delete_package_version(package: str, version: str, response: Response):
    """ Delete a package version

        Attributes:

            package (str): Package with version to be deleted
            version (str): Version to be deleted
            response (Response): Starlette response object
    """

    (package_doc, status_code, err) = package_exists(package)
    if package_doc is None:
        response.status_code = status_code
        return err

    package_versions = DB.table("package_versions")
    version_entry = get_package_version_by_version_string(package, version)

    if version_entry is None:
        msg = "Package version not found"
        logging.info(msg)
        response.status_code = status.HTTP_404_NOT_FOUND
        return {
            "error": "confrm-020",
            "message": msg,
            "detail": "While attempting to delete a package version the version specified" +
            " was not found"
        }

    package_versions.remove(doc_ids=[version_entry.doc_id])
    file_path = os.path.join(
        CONFIG["storage"]["data_dir"], version_entry["blob_id"])
    os.remove(file_path)

    # Check for any hanging canary entries
    try:
        remove_canary(package=package)
    except ValueError as err:
        if str(err) != "Canary Not Found":
            raise

    if "current_version" in package_doc.keys() and package_doc["current_version"] == version:
        msg = "Active version is not set"
        logging.info(msg)
        response.status_code = status.HTTP_200_OK
        return {
            "warning": "confrm-021",
            "message": msg,
            "detail": "While deleting a package version the version specified was set as the"
            " current active version. The package version was deleted and the active version "
            f" for package {package} is now not set"
        }

    return {}


@APP.get("/package/", status_code=status.HTTP_200_OK)
async def get_package(name: str, response: Response, lite: bool = False):
    """ Returns the package information, including URL for download """

    (package_doc, status_code, err) = package_exists(name)
    if package_doc is None:
        response.status_code = status_code
        return err
    return format_package_info(package_doc, lite)


@APP.get("/check_for_update/", status_code=status.HTTP_200_OK)
async def check_for_update(name: str, node_id: str, response: Response):
    """Called by node wanting to know if an update is available

    Will return the most recent package version for the given package name.
    Will check to see if a canary entry has been made for the node, if it is then
    the be canary settings will be returned.

    Arguments:
        name (str): Package to check for update for
        node_id (str): Id of the node making the request, or empty
        response (Response): Starlette response object for setting return codes
    Returns:
        HTTP_200_OK / {"current_version": ..., "blob": ...} if found
        HTTP_404_NOT_FOUND / Message header / {}  if not found
    """

    packages = DB.table("packages")

    query = Query()

    package_doc = packages.get(query.name == name)
    if package_doc is None:

        response.status_code = status.HTTP_404_NOT_FOUND
        return {
            "error": "confrm-011",
            "message": "No versions found for package",
            "detail": "While checking for updates the package was found in the database, " +
            "however there are no available versions of that package"
        }

    # Check to see if there is a canary entry for this node
    canary = get_canary(node_id=node_id)
    if canary is not None:
        version_doc = get_package_version_by_version_string(
            canary["package"],
            canary["version"]
        )
        if version_doc is None:
            logging.error("Canary version not set, removing canary entry...")
            remove_canary(node_id=node_id)
        else:
            return {
                "current_version": canary["version"],
                "blob": version_doc["blob_id"],
                "hash": version_doc["hash"],
                "force": canary["force"]
            }

    if "current_version" in package_doc.keys():
        version_entry = get_package_version_by_version_string(
            name,
            package_doc["current_version"])
        return {
            "current_version": package_doc["current_version"],
            "blob": version_entry["blob_id"],
            "hash": version_entry["hash"],
            "force": False
        }


@APP.put("/set_active_version/")
async def set_active_version(package: str, version: str):
    """ Set the active version via the API """
    # TODO: Set error codes

    query = Query()
    packages = DB.table("packages")

    package_entry = packages.get(query.name == package)
    if package_entry is None:
        return {"ok": False, "info": "Package does not exist"}

    version_doc = get_package_version_by_version_string(package, version)
    if len(version_doc) < 1:
        return {"ok": False, "info": "Specified version does not exist for package"}

    package_entry["current_version"] = version
    result = packages.update(package_entry, query.name == package)

    try:
        remove_canary(package=package)
    except ValueError as err:
        if str(err) != "Canary Not Found":
            raise

    if len(result) > 0:
        return {"ok": True}
    return {"ok": False}


@APP.put("/node_package/", status_code=status.HTTP_200_OK)
async def node_package(node_id: str, package: str, response: Response, version: str = ""):
    """Force a node to use a particular package using canary feature"""

    (package_doc, status_code, err) = package_exists(package)
    if package_doc is None:
        response.status_code = status_code
        return err

    if not version:
        if not package_doc["current_version"]:
            msg = "Package has no active version"
            logging.info(msg)
            response.status_code = status.HTTP_404_NOT_FOUND
            return {
                "error": "confrm-008",
                "message": msg,
                "detail": "While attempting to set a node to use a particular package the package" +
                " was found to have no active versions and no specific version was given"
            }
        version = package_doc["current_version"]
    else:
        version_doc = get_package_version_by_version_string(package, version)
        if version_doc is None:
            msg = "Package version not found"
            logging.info(msg)
            response.status_code = status.HTTP_404_NOT_FOUND
            return {
                "error": "confrm-018",
                "message": msg,
                "detail": "While attempting to set a node to use a particular package the " +
                " version given was not found"
            }

    (node_doc, status_code, err) = node_exists(node_id)
    if node_doc is None:
        response.status_code = status_code
        return err

    set_canary(package=package, version=version, node_id=node_id)

    return {}


@APP.get("/blob/", status_code=status.HTTP_200_OK)
async def get_blob(package: str, blob: str, response: Response):
    """ Set a blob file """

    query = Query()
    package_versions = DB.table("package_versions")

    (package_doc, status_code, err) = package_exists(package)
    if package_doc is None:
        response.status_code = status_code
        return err

    version_entry = package_versions.get(
        query.name == package and
        query.blob_id == blob)
    if version_entry is None:
        return {"ok": False, "info": "Specified blob does not exist for package"}

    # Read the file from the data store
    with open(os.path.join(CONFIG["storage"]["data_dir"], blob), "rb") as ptr:
        data = base64.b64decode(ptr.read())

    # Create sha256 of data from store
    _h = SHA256.new()
    _h.update(data)

    # Check hash against original
    if version_entry["hash"] != _h.hexdigest():
        print("Hashes do not match...")
        return

    return ConfrmFileResponse(data)


@APP.put("/config/", status_code=status.HTTP_201_CREATED)
async def put_config(type: str, key: str, value: str, response: Response, id: str = ""):
    """Adds new config to the config database

    Attributes:
        type (str): One of global, package or node
        id (str): Empty, package name or node_id
        key (str): Key to be stored
        value (str): Value to be stored
    """

    query = Query()
    config = DB.table("config")

    types = ["global", "package", "node"]

    if not type or type not in types:
        msg = "Type cannot be empty and must be a valid type"
        logging.info(msg)
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "error": "confrm-015",
            "message": msg,
            "detail": "While attempting to add a new config the type of config given was empty"
            " or was incorrect."
        }

    pattern = '^[0-9a-zA-Z_-]+$'
    regex = re.compile(pattern)

    if regex.match(key) is None:
        msg = f"Key name does not match pattern {pattern}"
        logging.info(msg)
        response.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "error": "confrm-016",
            "message": msg,
            "detail": "While attempting to add a new config the key given did not match the"
            f" pattern {pattern}"
        }

    if type == "global":
        key_doc = config.get((query.key == key) & (query.type == "global"))
        if key_doc is not None:
            config.update({"value": value}, doc_ids=[key_doc.doc_id])
            # TODO: Warning for updating, including from and to values
        else:
            config_doc = {
                "type": type,
                "id": id,
                "key": key,
                "value": value
            }
            config.insert(config_doc)

    elif type == "package":
        (package_doc, status_code, err) = package_exists(id)
        if package_doc is None:
            response.status_code = status_code
            return err

        key_doc = config.get((query.key == key) &
                             (query.type == "package") &
                             (query.id == id))
        if key_doc is not None:
            config.update({"value": value}, doc_ids=[key_doc.doc_id])
            # TODO: Warning for updating, including from and to values
        else:
            config_doc = {
                "type": type,
                "id": id,
                "key": key,
                "value": value
            }
            config.insert(config_doc)

    elif type == "node":
        (node_doc, status_code, err) = node_exists(id)
        if node_doc is None:
            response.status_code = status_code
            return err

        key_doc = config.get((query.key == key) &
                             (query.type == "node") &
                             (query.id == id))

        if key_doc is not None:
            config.update({"value": value}, doc_ids=[key_doc.doc_id])
            # TODO: Warning for updating, including from and to values
        else:
            config_doc = {
                "type": type,
                "id": id,
                "key": key,
                "value": value
            }
            config.insert(config_doc)

    return {}


@APP.get("/config/", status_code=status.HTTP_200_OK)
async def get_config(response: Response, key: str = "", package: str = "", node_id: str = ""):
    """Get configuration value from database

    Attributes:

        key (str): Key to retrieve
        response (Response): Starlette response object
        package (str): Package of requesting node
        node_id (str): node_id of requesting node
    """

    query = Query()
    config = DB.table("config")

    if node_id:
        (doc, status_code, err) = node_exists(node_id)
        if doc is None:
            response.status_code = status_code
            return err
        doc = config.get((query.type == "node") &
                         (query.id == node_id) &
                         (query.key == key))
        if doc is not None:
            return {"value": doc["value"]}

    if package:
        (doc, status_code, err) = package_exists(package)
        if doc is None:
            response.status_code = status_code
            return err
        doc = config.get((query.type == "package") &
                         (query.id == package) &
                         (query.key == key))
        if doc is not None:
            return {"value": doc["value"]}

    if not key:
        # Do deepcopy to save changing database by accident
        configs = deepcopy(config.all())
        packages = DB.table("packages")
        nodes = DB.table("nodes")
        for config in configs:
            if config["type"] == "package":
                package_doc = packages.get(query.name == config["id"])
                if package_doc is not None:
                    config["package_title"] = package_doc["title"]
            elif config["type"] == "node":
                node_doc = nodes.get(query.node_id == config["id"])
                if node_doc is not None:
                    config["node_title"] = node_doc["title"]
        return sort_configs(configs)

    # Must be global...
    doc = config.get((query.type == "global") &
                     (query.key == key))
    if doc is None:
        msg = "Key not found"
        logging.info(msg)
        response.status_code = status.HTTP_404_NOT_FOUND
        return {
            "error": "confrm-012",
            "message": msg,
            "detail": f"Key \"{key}\" was not found for package \"{package}\""
            " / node \"{node_id}\""
        }

    return {"value": doc["value"]}


@APP.delete("/config/", status_code=status.HTTP_200_OK)
async def delete_config(key: str, type: str, response: Response, id: str = ""):
    """Delete a config from the database

    Attributes:

        key (str): key to be deleted
        type (str): global/package/node
        id (str): package or node id as per type
        response (Response): Starlette response object
    """

    query = Query()
    config = DB.table("config")

    if type == "global":

        global_doc = config.get((query.key == key) &
                                (query.type == "global"))
        if global_doc is not None:
            config.remove(doc_ids=[global_doc.doc_id])
        else:
            msg = "Key not found"
            logging.info(msg)
            response.status_code = status.HTTP_404_NOT_FOUND
            return {
                "error": "confrm-024",
                "message": msg,
                "detail": f"Key \"{key}\" was not found, unable to delete it"
            }

    elif type == "package":

        package_doc = config.get((query.key == key) &
                                 (query.id == id) &
                                 (query.type == "package"))

        if package_doc is not None:
            config.remove(doc_ids=[package_doc.doc_id])
        else:
            msg = "Key not found"
            logging.info(msg)
            response.status_code = status.HTTP_404_NOT_FOUND
            return {
                "error": "confrm-024",
                "message": msg,
                "detail": f"Key \"{key}\" was not found for package \"{id}\","
                " unable to delete it"
            }

    elif type == "node":

        node_doc = config.get((query.key == key) &
                              (query.id == id) &
                              (query.type == "node"))

        if node_doc is not None:
            config.remove(doc_ids=[node_doc.doc_id])
        else:
            msg = "Key not found"
            logging.info(msg)
            response.status_code = status.HTTP_404_NOT_FOUND
            return {
                "error": "confrm-024",
                "message": msg,
                "detail": f"Key \"{key}\" was not found for node \"{id}\","
                " unable to delete it"
            }

    return {}
