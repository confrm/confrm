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
"""

import base64
import logging
import os
import time
import uuid

import toml

from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from fastapi import FastAPI, File, Depends, Response, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from tinydb import TinyDB, Query
from markupsafe import escape
from pydantic import BaseModel # pylint: disable=E0611

from confrm.responses import ConfrmFileResponse

logger = logging.getLogger('confrm')
logger.setLevel(logging.INFO)

# pydantic data models are used to describe the inputs for the various REST
# API calls, if the calls do not match these names and data-types then the call
# to FastAPI will fail

class Package(BaseModel): #pylint: disable=R0903
    """Definition of a package"""
    name: str
    title: str
    description: str
    platform: str

class PackageVersion(BaseModel): #pylint: disable=R0903
    """Definition of a package version"""
    name: str
    major: int
    minor: int
    revision: int

APP = FastAPI()
CONFIG = None
DB = None

def do_config():
    """Gets the config based on an environment variable and sets up global
    objects as required """

    global CONFIG, DB # pylint: disable=W0603

    CONFIG = toml.load(os.environ["CONFRM_CONFIG"])

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
        version_str = f'{entry["major"]}.{entry["minor"]}.{entry["revision"]}'
        if "current_version" in package.keys() and \
            version_str == package["current_version"]:
            current_version = {
                "number": version_str,
                "date": entry["date"],
                "blob": entry["blob_id"]
            }
        else:
            versions.append({
                "number": version_str,
                "date": entry["date"],
                "blob": entry["blob_id"]
            })
            versions = sorted(
                    versions,
                    key=lambda x: [int(i) if i.isdigit() else i for i in x["number"].split('.')],
                    reverse = True
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
            "current_version": current_version
        }

    versions = get_package_versions(package["name"], package)

    latest_version = current_version
    if len(versions) > 0:
        latest_version = max(versions, key=lambda x:x["date"])["number"]

    return {
       "title": package["title"],
       "description": package["description"],
       "platform": package["platform"],
       "current_version": current_version,
       "latest_version": latest_version,
       "versions" : versions
    }


# Files server in /static will point to ./dashboard (with respect to the running
# script)
APP.mount("/static", StaticFiles(directory="dashboard"), name="home")

@APP.get("/")
async def index():
    """Returns index page for UI"""
    return FileResponse("dashboard/index.html")


@APP.get("/info/")
async def info():
    """Get basic info for UI elements"""
    if CONFIG is None:
        do_config()

    ret = {}
    packages = DB.table('packages')
    ret["packages_installed"] = len(packages)

    return ret


@APP.get("/time/")
async def get_time():
    """Returns time of day from server as unix epoch time"""
    if CONFIG is None:
        do_config()

    return { "time": round(time.time()) }


@APP.put("/register_node/", status_code=status.HTTP_200_OK)
async def register_node(node_id: str, package: str, version: str, response: Response):
    """Registers a node to the server

    Attributes:
        node_id (str): The node id, must be unique, MAC addresses work well
        package (str): Package installed on the node
        version (str): Version string of currently running package
        response (Response): Starlette response object for setting return codes

    Returns:
        HTTP_200_OK / {} if registration successful
        HTTP_404_NOT_FOUND / {"info": msg} if not successful, information is msg
    """
    if CONFIG is None:
        do_config()

    packages = DB.table("packages")
    nodes = DB.table("nodes")

    query = Query()

    package_entry = packages.get(query.name == package)
    if package_entry is None:
        response.status_code = status.HTTP_404_NOT_FOUND
        return {"info": "Unknown package name"}

    node_entry = nodes.get(query.node_id == node_id)
    if node_entry is None:
        entry = {
                "node_id": node_id,
                "package": package,
                "version": version,
                "last_updated": -1,
                "last_seen": round(time.time())
        }
        nodes.insert(entry)
        return {}

    # Update the package entry based on package name change, new version of a package
    # and register this as the last update time
    if node_entry["package"] != package: # Package changed
        node_entry["package"] = package
        node_entry["version"] = version
        node_entry["last_updated"] = -1
    elif node_entry["version"] != version: # Version of package changed
        node_entry["version"] = version
        node_entry["last_updated"] = round(time.time())
    node_entry["last_seen"] = round(time.time())

    nodes.update(node_entry, query.node_id == node_id)

    return {}


@APP.get("/nodes/")
async def get_nodes(package: str):
    """Returns a list of nodes using a given package

    Attributes:
        package (str): name of package to return node list for
    """
    if CONFIG is None:
        do_config()

    nodes = DB.table("nodes")
    query = Query()

    node_list = nodes.search(query.package == package)

    if len(node_list) == 0:
        return {}

    return node_list


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


@APP.post("/add_package/")
async def add_package(package: Package = Depends()):
    """Uploads a package with optional binary package

    Attributes:
        package (Package): Package description to be added
    """
    if CONFIG is None:
        do_config()

    # Update storage record to include the local information
    package_dict = package.__dict__

    # Escape the strings
    for key in package_dict.keys():
        if str == type(package_dict[key]):
            package_dict[key] = escape(package_dict[key])

    packages = DB.table("packages")
    query = Query()

    existing_name = packages.get(query.name == package_dict["name"])
    if existing_name is not None:
        return {"ok": False} # TODO: Return more useful error

    packages.insert(package_dict)

    return {"ok": True}

@APP.post("/package_version/")
async def add_package_version(package_version: PackageVersion = Depends(), file: bytes = File(...)):
    """ Uploads a package with optional binary package """
    if CONFIG is None:
        do_config()

    # Package was uploaded, create hash of binary
    _h = SHA256.new()
    _h.update(file)

    # Store the binary in the data_store as a base64 encoded file
    filename = uuid.uuid4().hex
    save_file = os.path.join(CONFIG["storage"]["data_dir"], filename)
    with open(save_file, "wb") as ptr:
        ptr.write(base64.b64encode(file))

    # Update storage record to include the local information
    package_dict = package_version.__dict__

    # Escape the strings
    for key in package_dict.keys():
        if str == type(package_dict[key]):
            package_dict[key] = escape(package_dict[key])

    # Update with blob details
    package_dict["date"] = round(time.time())
    package_dict["hash"] = _h.hexdigest()
    package_dict["blob_id"] = filename

    # Store in the database
    packages = DB.table("package_versions")
    packages.insert(package_dict)

    return {"ok": True}

@APP.delete("/package_version/")
async def del_package_version(name: str, version: str):
    """ Delete a version """
    if CONFIG is None:
        do_config()

    packages = DB.table("packages")
    query = Query()

    package = packages.get(query.name == name)
    if package is not None:
        if "current_version" in package.keys():
            if version == package["current_version"]:
                return { "ok": False }

    package_versions = DB.table("package_versions")
    parts = version.split(".")
    version_entry = package_versions.get( \
        (query.name == name) & \
        (query.major == int(parts[0])) & \
        (query.minor == int(parts[1])) & \
        (query.revision == int(parts[2])))

    if version_entry is None:
        return { "ok" : False }

    package_versions.remove(doc_ids = [version_entry.doc_id])
    file_path = os.path.join(CONFIG["storage"]["data_dir"], version_entry["blob_id"])
    os.remove(file_path)

    return { "ok" : True }


@APP.get("/package/")
async def get_package(name: str, lite: bool = False):
    """ Returns the package information, including URL for download """
    if CONFIG is None:
        do_config()

    packages = DB.table("packages")
    query = Query()
    package = packages.get(query.name == name)
    if package is not None:
        # Sign the binary hash with the current private key
#        blob_hash = int.from_bytes(str.encode(package["blob_hash"]), byteorder="big")
#        signature = hex(pow(blob_hash, privateKey.d, privateKey.n))
#        package["signature"] = signature
#        del package["blob"]
#
#        bytesig = bytes.fromhex(signature[2:])
#        hashFromSig = pow(int.from_bytes(bytesig, byteorder='big'), privateKey.e, privateKey.n)
#
#        print(blob_hash)
#        print(hashFromSig)

        return format_package_info(package, lite)

    return {}

@APP.get("/check_for_update/", status_code=status.HTTP_200_OK)
async def check_for_update(name: str, node_id: str, response: Response):
    if CONFIG is None:
        do_config()

    packages = DB.table("packages")
    package_versions = DB.table("package_versions")
    query = Query()

    package = packages.get(query.name == name)
    if package is not None:
        if "current_version" in package.keys():
            parts = package["current_version"].split(".")
            version_entry = package_versions.get( \
                    (query.name == name) & \
                    (query.major == int(parts[0])) & \
                    (query.minor == int(parts[1])) & \
                    (query.revision == int(parts[2])))
            return {
                "current_version": package["current_version"],
                "blob" : version_entry["blob_id"]
            }

        response.status_code = status.HTTP_404_NOT_FOUND
        return {"info": "No versions for package"}

    response.status_code = status.HTTP_404_NOT_FOUND
    return {"info": "Package not found"}


@APP.put("/set_active_version/")
async def set_active_version(name: str, version: str):
    """ Set the active version via the API """
    if CONFIG is None:
        do_config()

    query = Query()
    packages = DB.table("packages")
    package_versions = DB.table("package_versions")

    package_entry = packages.get(query.name == name)
    if package_entry is None:
        return {"ok" : False, "info": "Package does not exist"}

    parts = version.split(".")
    version_entry = package_versions.search( \
            (query.name == name) & \
            (query.major == int(parts[0])) & \
            (query.minor == int(parts[1])) & \
            (query.revision == int(parts[2]) ))
    if len(version_entry) < 1:
        return {"ok": False, "info": "Specified version does not exist for package"}

    package_entry["current_version"] = version
    result = packages.update(package_entry, query.name == name)

    if len(result) > 0:
        return {"ok": True}
    return {"ok": False}

@APP.get("/blob/")
async def blob(name: str, blob: str):
    """ Set a blob file """
    if CONFIG is None:
        do_config()

    query = Query()
    packages = DB.table("packages")
    package_versions = DB.table("package_versions")

    package_entry = packages.get(query.name == name)
    if package_entry is None:
        return {"ok" : False, "info": "Package does not exist"}

    version_entry = package_versions.get( \
            query.name == name and \
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
