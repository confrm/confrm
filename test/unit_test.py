"""Unit tests for confrm API"""

import os
import tempfile
import pytest

from fastapi.testclient import TestClient

from confrm import APP

CONFIG_NAME = "confrm.toml"


def get_config_file(path: str):
    """Returns a valid config file with data directory set to input argument"""
    ret = '' + \
          '[basic]\n' + \
          'port = 8001\n\n' + \
          '[storage]\n' + \
          f'data_dir = "{path}"'
    return ret


def test_no_env():
    """Test for env not set"""
    with pytest.raises(ValueError):
        client = TestClient(APP)
        _ = client.get("/time/")


def test_incorrect_env():
    """Test for env set incorrectly - points to non-existent file"""
    with tempfile.TemporaryDirectory() as data_dir:
        os.environ["CONFRM_CONFIG"] = os.path.join(data_dir, CONFIG_NAME)
        with pytest.raises(ValueError):
            client = TestClient(APP)
            _ = client.get("/time/")


# def test_wrong_config():
#    # Requires refactor of create_test_folder to take alternative data_dir...
#    pass


def test_get_time():
    """time should return the current epoch time"""
    with tempfile.TemporaryDirectory() as data_dir:
        config_file = os.path.join(data_dir, CONFIG_NAME)
        with open(config_file, "w") as file:
            file.write(get_config_file(data_dir))
        os.environ["CONFRM_CONFIG"] = config_file

        client = TestClient(APP)
        response = client.get("/time/")
        assert response.status_code == 200
        assert "time" in response.json().keys()
        assert int(response.json()["time"])


def test_get_info():
    """time should return the current epoch time"""
    with tempfile.TemporaryDirectory() as data_dir:
        config_file = os.path.join(data_dir, CONFIG_NAME)
        with open(config_file, "w") as file:
            file.write(get_config_file(data_dir))
        os.environ["CONFRM_CONFIG"] = config_file

        with TestClient(APP) as client:

            response = client.get("/info/")
            assert response.status_code == 200
            assert "packages" in response.json().keys()
            assert int(response.json()["packages"]) == 0

            response = client.put("/package/" +
                                  "?name=test_package" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            response = client.get("/info/")
            assert response.status_code == 200
            assert "packages" in response.json().keys()
            assert int(response.json()["packages"]) == 1


def test_put_package():
    """Test the package adding works"""

    with tempfile.TemporaryDirectory() as data_dir:
        config_file = os.path.join(data_dir, CONFIG_NAME)
        with open(config_file, "w") as file:
            file.write(get_config_file(data_dir))
        os.environ["CONFRM_CONFIG"] = config_file

        with TestClient(APP) as client:

            response = client.put("/package/" +
                                  "?name=test_package" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            # Test the package was stored correctly
            response = client.get("/package/?name=test_package")
            assert response.status_code == 200
            data = response.json()
            assert {"name", "description", "title", "platform"} <= data.keys()
            assert data["name"] == "test_package"
            assert data["description"] == "some description"
            assert data["title"] == "Good Name"
            assert data["platform"] == "esp32"

            # Check duplicates are rejected
            response = client.put("/package/" +
                                  "?name=test_package" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 400
            assert response.json()["error"] == "confrm-003"

            # Check that input is escaped
            response = client.put("/package/" +
                                  "?name=test_package2" +
                                  "&description=<b>some%20description</b>" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            response = client.get("/package/?name=test_package2")
            assert response.status_code == 200
            assert response.json()["description"].startswith("&lt;b&gt;")

            # Check empty name is rejected
            response = client.put("/package/" +
                                  "?name=" +
                                  "&description=<b>some%20description</b>" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 400
            assert response.json()["error"] == "confrm-004"

            # Check empty title is replaced with name
            response = client.put("/package/" +
                                  "?name=good_name" +
                                  "&description=<b>some%20description</b>" +
                                  "&title=" +
                                  "&platform=esp32")
            assert response.status_code == 201

            response = client.get("/package/?name=good_name")
            assert response.status_code == 200
            assert response.json()["title"] == "good_name"

            # Check invalid names are rejected (space)
            response = client.put("/package/" +
                                  "?name=test%20package" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 400

            # Check invalid names are rejected (asterisk)
            response = client.put("/package/" +
                                  "?name=test%2Apackage" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 400


def test_delete_package():
    """Test the package deleting works"""

    with tempfile.TemporaryDirectory() as data_dir:
        config_file = os.path.join(data_dir, CONFIG_NAME)
        with open(config_file, "w") as file:
            file.write(get_config_file(data_dir))
        os.environ["CONFRM_CONFIG"] = config_file

        test_file_content = bytearray(os.urandom(1000))
        test_file = os.path.join(data_dir, "test.bin")
        with open(test_file, "wb") as file_ptr:
            file_ptr.write(test_file_content)

        with TestClient(APP) as client:

            response = client.put("/package/" +
                                  "?name=test_package" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            # Add a package version - keep track of files in data directory
            files = os.listdir(os.path.join(data_dir, "blob"))
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=test_package" +
                                       "&major=1" +
                                       "&minor=2" +
                                       "&revision=3",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 201
            files_new = os.listdir(os.path.join(data_dir, "blob"))

            # Get the newly created file
            new_file = ""
            for filename in files_new:
                if filename not in files:
                    new_file = filename
            assert new_file
            assert os.path.isfile(os.path.join(os.path.join(data_dir, "blob"), new_file))

            # Create a config for this package
            response = client.put("/config/" +
                                  "?type=package" +
                                  "&id=test_package" +
                                  "&key=key_a"
                                  "&value=value_package")
            assert response.status_code == 201

            # Test the config worked
            response = client.get("/config/" +
                                  "?key=key_a" +
                                  "&package=test_package")
            assert response.status_code == 200

            # Test the package was stored correctly
            response = client.get("/package/?name=test_package")
            assert response.status_code == 200

            # Test deleting a package that does not exist
            response = client.delete("/package/" +
                                     "?name=not_there")
            assert response.status_code == 404
            assert response.json()["error"] == "confrm-000"

            # Test delete the package
            response = client.delete("/package/" +
                                     "?name=test_package")
            assert response.status_code == 200

            # Test the package was deleted
            response = client.get("/package/?name=test_package")
            assert response.status_code == 404

            # Check the file was deleted too
            assert not os.path.isfile(os.path.join(os.path.join(data_dir, "blob"), new_file))

            # Test the config was deleted
            response = client.get("/config/" +
                                  "?key=key_a" +
                                  "&package=test_package")
            assert response.status_code == 404


def test_delete_package_version():
    """Tests deleting versions for a given package"""

    with tempfile.TemporaryDirectory() as data_dir:
        config_file = os.path.join(data_dir, CONFIG_NAME)
        with open(config_file, "w") as file:
            file.write(get_config_file(data_dir))
        os.environ["CONFRM_CONFIG"] = config_file

        test_file_content = bytearray(os.urandom(1000))
        test_file = os.path.join(data_dir, "test.bin")
        with open(test_file, "wb") as file_ptr:
            file_ptr.write(test_file_content)

        with TestClient(APP) as client:

            # Tests error generated when packages does not exist
            response = client.delete("/package_version/" +
                                     "?package=test_package" +
                                     "&version=1.2.3")
            assert response.status_code == 404

            # Create a package to add versions to
            response = client.put("/package/" +
                                  "?name=test_package" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            # Check files upload okay
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=test_package" +
                                       "&major=1" +
                                       "&minor=2" +
                                       "&revision=3",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 201

            # Upload another version with active version set
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=test_package" +
                                       "&major=1" +
                                       "&minor=2" +
                                       "&revision=4" +
                                       "&set_active=true",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 201

            # Check both versions are there
            response = client.get("/package/?name=test_package")
            assert response.status_code == 200
            assert next((item for item in response.json()[
                        "versions"] if item["number"] == "1.2.3"), None) is not None
            assert next((item for item in response.json()[
                        "versions"] if item["number"] == "1.2.4"), None) is not None

            # Delete one of the versions
            response = client.delete("/package_version/" +
                                     "?package=test_package" +
                                     "&version=1.2.3")
            assert response.status_code == 200

            # Check only one version remains
            response = client.get("/package/?name=test_package")
            assert response.status_code == 200
            assert next((item for item in response.json()[
                "versions"] if item["number"] == "1.2.3"), None) is None
            assert next((item for item in response.json()[
                        "versions"] if item["number"] == "1.2.4"), None) is not None
            assert "warning" not in response.json().keys()

            # Delete the remaining version - check for warning as it was active
            response = client.delete("/package_version/" +
                                     "?package=test_package" +
                                     "&version=1.2.4")
            assert response.status_code == 200
            assert response.json()["warning"] == "confrm-021"


def test_post_package_version():
    """Tests adding versions for a given package"""

    with tempfile.TemporaryDirectory() as data_dir:
        config_file = os.path.join(data_dir, CONFIG_NAME)
        with open(config_file, "w") as file:
            file.write(get_config_file(data_dir))
        os.environ["CONFRM_CONFIG"] = config_file

        test_file_content = bytearray(os.urandom(1000))
        test_file = os.path.join(data_dir, "test.bin")
        with open(test_file, "wb") as file_ptr:
            file_ptr.write(test_file_content)

        with TestClient(APP) as client:

            # Tests error generated when packages does not exist
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=test_package" +
                                       "&major=1" +
                                       "&minor=2" +
                                       "&revision=3",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 404

            # Create a package to add versions to
            response = client.put("/package/" +
                                  "?name=test_package" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            # Check files upload okay
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=test_package" +
                                       "&major=1" +
                                       "&minor=2" +
                                       "&revision=3",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 201

            # Check active version defaults to false
            response = client.get("/package/?name=test_package")
            assert response.status_code == 200
            assert response.json()["current_version"] == ""

            # Upload another version with active version set
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=test_package" +
                                       "&major=1" +
                                       "&minor=2" +
                                       "&revision=4" +
                                       "&set_active=true",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 201

            # Check active version defaults to false
            response = client.get("/package/?name=test_package")
            assert response.status_code == 200
            assert response.json()["current_version"] == "1.2.4"

            # Upload a duplicate version
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=test_package" +
                                       "&major=1" +
                                       "&minor=2" +
                                       "&revision=4" +
                                       "&set_active=true",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 400
                assert response.json()["error"] == "confrm-006"

            # Negative version number
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=test_package" +
                                       "&major=-1" +
                                       "&minor=2" +
                                       "&revision=4" +
                                       "&set_active=true",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 400
                assert response.json()["error"] == "confrm-017"


def test_put_node_package_via_package_version():
    """Tests changing the package for a given node"""

    with tempfile.TemporaryDirectory() as data_dir:
        config_file = os.path.join(data_dir, CONFIG_NAME)
        with open(config_file, "w") as file:
            file.write(get_config_file(data_dir))
        os.environ["CONFRM_CONFIG"] = config_file

        test_file_content = bytearray(os.urandom(1000))
        test_file = os.path.join(data_dir, "test.bin")
        with open(test_file, "wb") as file_ptr:
            file_ptr.write(test_file_content)

        with TestClient(APP) as client:

            # Create two packages for testing
            response = client.put("/package/" +
                                  "?name=package_a" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201
            response = client.put("/package/" +
                    "?name=package_b" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            # Add active version to package
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=package_a" +
                                       "&major=0" +
                                       "&minor=1" +
                                       "&revision=0" +
                                       "&set_active=true",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 201

            # Register a node with confrm
            response = client.put("/register_node/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_a" +
                                  "&version=" +
                                  "&description=some%20description" +
                                  "&platform=esp32")
            assert response.status_code == 200

            ###################################################################
            ## To start with the registered node should get the active verion
            ## for package_a.
            ##
            ## Once a version is added for package_b and the node is set as the
            ## canary, then the package_b version should be returned
            ###################################################################

            # Check for update
            response = client.get("/check_for_update/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_a")
            assert response.status_code == 200
            assert response.json()["current_version"] == "0.1.0"

            # Add active version to package_b with the canary node set
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=package_b" +
                                       "&major=0" +
                                       "&minor=2" +
                                       "&revision=0" +
                                       "&set_active=false" +
                                       "&canary_id=0:12:3:4",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 201

            # Check for update (will be a package with version 0.2.0)
            response = client.get("/check_for_update/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_a")
            assert response.status_code == 200
            assert response.json()["current_version"] == "0.2.0"
            assert response.json()["force"]

            # Re-Register a node with confrm using the forced package
            response = client.put("/register_node/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_b" +
                                  "&version=0.2.0" +
                                  "&description=some%20description" +
                                  "&platform=esp32")
            assert response.status_code == 200

            # Check for update (will be a package with version 0.2.0, but not forced)
            response = client.get("/check_for_update/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_b")
            assert response.status_code == 200
            assert response.json()["current_version"] == "0.2.0"
            assert not response.json()["force"]

            # Get canary will still report that it is a canary
            response = client.get("/canary/" +
                                  "?node_id=0:12:3:4")
            assert response.status_code == 200
            assert response.json()["package"] == "package_b"
            assert response.json()["version"] == "0.2.0"

            # Setting the active version for package_b will clear the canary
            response = client.put("/set_active_version/" +
                                  "?package=package_b" +
                                  "&version=0.2.0")
            assert response.status_code == 200

            # Get canary will still report that it is a canary
            response = client.get("/canary/" +
                                  "?node_id=0:12:3:4")
            assert response.status_code == 404


def test_put_node_package():
    """Tests changing the package for a given node"""

    with tempfile.TemporaryDirectory() as data_dir:
        config_file = os.path.join(data_dir, CONFIG_NAME)
        with open(config_file, "w") as file:
            file.write(get_config_file(data_dir))
        os.environ["CONFRM_CONFIG"] = config_file

        test_file_content = bytearray(os.urandom(1000))
        test_file = os.path.join(data_dir, "test.bin")
        with open(test_file, "wb") as file_ptr:
            file_ptr.write(test_file_content)

        with TestClient(APP) as client:

            # Create two packages for testing
            response = client.put("/package/" +
                                  "?name=package_a" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            response = client.put("/package/" +
                                  "?name=package_b" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            # Add active versions to both packages
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=package_a" +
                                       "&major=0" +
                                       "&minor=1" +
                                       "&revision=0" +
                                       "&set_active=true",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 201

            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=package_b" +
                                       "&major=0" +
                                       "&minor=2" +
                                       "&revision=0" +
                                       "&set_active=true",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 201

            # Register a node with confrm
            response = client.put("/register_node/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_a" +
                                  "&version=" +
                                  "&description=some%20description" +
                                  "&platform=esp32")
            assert response.status_code == 200

            # Check for update
            response = client.get("/check_for_update/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_a")
            assert response.status_code == 200
            assert response.json()["current_version"] == "0.1.0"

            # Force the next version to be a different package using canary feature
            response = client.put("/node_package/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_b")
            assert response.status_code == 200

            # Check for update (will be package_b with version 0.2.0)
            response = client.get("/check_for_update/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_a")
            assert response.status_code == 200
            assert response.json()["current_version"] == "0.2.0"
            assert response.json()["force"]

            # Put in a newer package versions for the packages, set as active - will overwrite canary
            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=package_a" +
                                       "&major=0" +
                                       "&minor=1" +
                                       "&revision=1" +
                                       "&set_active=true",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 201

            with open(test_file, "rb") as file_ptr:
                response = client.post("/package_version/" +
                                       "?name=package_b" +
                                       "&major=0" +
                                       "&minor=2" +
                                       "&revision=1" +
                                       "&set_active=true",
                                       files={"file": ("filename", file_ptr, "application/binary")})
                assert response.status_code == 201

            # Check for update - should be back to package_a with 0.0.1, not forced
            response = client.get("/check_for_update/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_a")
            assert response.status_code == 200
            assert response.json()["current_version"] == "0.1.1"
            assert not response.json()["force"]



def test_config():
    """Tests config functions"""

    with tempfile.TemporaryDirectory() as data_dir:
        config_file = os.path.join(data_dir, CONFIG_NAME)
        with open(config_file, "w") as file:
            file.write(get_config_file(data_dir))
        os.environ["CONFRM_CONFIG"] = config_file

        with TestClient(APP) as client:

            # Create package for testing (package_a)
            response = client.put("/package/" +
                                  "?name=package_a" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            # Create package for testing (package_b)
            response = client.put("/package/" +
                                  "?name=package_b" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            # Create node for testing
            response = client.put("/register_node/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_a" +
                                  "&version=0.2.0" +
                                  "&description=some%20description" +
                                  "&platform=esp32")
            assert response.status_code == 200

            # Create node for testing
            response = client.put("/register_node/" +
                                  "?node_id=1:12:3:4" +
                                  "&package=package_a" +
                                  "&version=0.2.0" +
                                  "&description=some%20description" +
                                  "&platform=esp32")
            assert response.status_code == 200

            # Add a new global config
            response = client.put("/config/" +
                                  "?type=global" +
                                  "&id=" +
                                  "&key=key_a"
                                  "&value=value_a")
            assert response.status_code == 201

            # Add a new package config
            response = client.put("/config/" +
                                  "?type=package" +
                                  "&id=package_a" +
                                  "&key=key_b"
                                  "&value=value_b")
            assert response.status_code == 201

            # Add a new node config
            response = client.put("/config/" +
                                  "?type=node" +
                                  "&id=0:12:3:4" +
                                  "&key=key_c"
                                  "&value=value_c")
            assert response.status_code == 201

            # Test for non-existing package
            response = client.put("/config/" +
                                  "?type=package" +
                                  "&id=package_z" +
                                  "&key=key_z"
                                  "&value=value_b")
            assert response.status_code == 404
            assert response.json()["error"] == "confrm-000"

            # Test for non-existing node
            response = client.put("/config/" +
                                  "?type=node" +
                                  "&id=0:12:3:5" +
                                  "&key=key_x"
                                  "&value=value_x")
            assert response.status_code == 404
            assert response.json()["error"] == "confrm-001"

            # Test for no type given
            response = client.put("/config/" +
                                  "?type=" +
                                  "&id=package_a" +
                                  "&key=key_b"
                                  "&value=value_b")
            assert response.status_code == 400
            assert response.json()["error"] == "confrm-015"

            # Test incorrect type give (same error number as empty)
            response = client.put("/config/" +
                                  "?type=thing" +
                                  "&id=package_a" +
                                  "&key=key_b"
                                  "&value=value_b")
            assert response.status_code == 400
            assert response.json()["error"] == "confrm-015"

            # Test key containing incorrect characters
            response = client.put("/config/" +
                                  "?type=package" +
                                  "&id=package_a" +
                                  "&key=key%20b"
                                  "&value=value_b")
            assert response.status_code == 400
            assert response.json()["error"] == "confrm-016"

            # Test retrieving config keys
            response = client.get("/config/" +
                                  "?key=key_a" +
                                  "&package=package_a" +
                                  "&node_id=0:12:3:4")
            assert response.status_code == 200
            assert response.json()["value"] == "value_a"

            # Test retrieving config keys (does not exist)
            response = client.get("/config/" +
                                  "?key=key_not_there" +
                                  "&package=package_a" +
                                  "&node_id=0:12:3:4")
            assert response.status_code == 404

            # Add a new package config (override for global key_a)
            response = client.put("/config/" +
                                  "?type=package" +
                                  "&id=package_b" +
                                  "&key=key_a"
                                  "&value=value_package_b")
            assert response.status_code == 201

            # Add a new node config (override for global key_a)
            response = client.put("/config/" +
                                  "?type=node" +
                                  "&id=1:12:3:4" +
                                  "&key=key_a"
                                  "&value=value_node2")
            assert response.status_code == 201

            # Test retrieving config keys (package override)
            response = client.get("/config/" +
                                  "?key=key_a" +
                                  "&package=package_b" +
                                  "&node_id=0:12:3:4")
            assert response.status_code == 200
            assert response.json()["value"] == "value_package_b"

            # Test retrieving config keys (node override)
            response = client.get("/config/" +
                                  "?key=key_a" +
                                  "&package=package_b" +
                                  "&node_id=1:12:3:4")
            assert response.status_code == 200
            assert response.json()["value"] == "value_node2"

            # Test getting all config keys
            response = client.get("/config/?key=")
            assert response.status_code == 200
            assert len(response.json()) > 0

            # Change a config (node)
            response = client.put("/config/" +
                                  "?type=node" +
                                  "&id=1:12:3:4" +
                                  "&key=key_a"
                                  "&value=value_changed")
            assert response.status_code == 201

            # Test retrieving changed config key (node override)
            response = client.get("/config/" +
                                  "?key=key_a" +
                                  "&package=package_a" +
                                  "&node_id=1:12:3:4")
            assert response.status_code == 200
            assert response.json()["value"] == "value_changed"

            # Change a config (package)
            response = client.put("/config/" +
                                  "?type=package" +
                                  "&id=package_b" +
                                  "&key=key_a"
                                  "&value=value_changed_package")
            assert response.status_code == 201

            # Test retrieving changed config key (package)
            response = client.get("/config/" +
                                  "?key=key_a" +
                                  "&package=package_b")
            assert response.status_code == 200
            assert response.json()["value"] == "value_changed_package"

            # Change a config (global)
            response = client.put("/config/" +
                                  "?type=global" +
                                  "&key=key_a"
                                  "&value=value_changed_global")
            assert response.status_code == 201

            # Test retrieving changed config key (global)
            response = client.get("/config/" +
                                  "?key=key_a")
            assert response.status_code == 200
            assert response.json()["value"] == "value_changed_global"

            ###################################################################
            # Deleting a key that does not exist should create an error
            ###################################################################

            # Test deleting a config that does not exist
            response = client.delete("/config/" +
                                     "?key=key_not_here" +
                                     "&type=global")
            assert response.status_code == 404
            assert response.json()["error"] == "confrm-024"

            ###################################################################
            # Test getting / deleting / getting a key, should be pass, pass
            # fail - global key
            ###################################################################

            # Test retrieving a key prior to deletion (global)
            response = client.get("/config/" +
                                  "?key=key_a")
            assert response.status_code == 200

            # Test deleting a config that does exist (global)
            response = client.delete("/config/" +
                                     "?key=key_a" +
                                     "&type=global")
            assert response.status_code == 200

            # Test retrieving deleted key (global)
            response = client.get("/config/" +
                                  "?key=key_a")
            assert response.status_code == 404
            assert response.json()["error"] == "confrm-012"

            ###################################################################
            # Test getting / deleting / getting a key, should be pass, pass
            # fail - package key
            ###################################################################

            # Test retrieving key prior to deletion
            response = client.get("/config/" +
                                  "?key=key_a" +
                                  "&package=package_b")
            assert response.status_code == 200

            # Test deleting a config that does exist (package)
            response = client.delete("/config/" +
                                     "?key=key_a" +
                                     "&type=package" +
                                     "&id=package_b")
            assert response.status_code == 200

            # Test retrieving deleted key (package)
            response = client.get("/config/" +
                                  "?key=key_a" +
                                  "&package=package_b")
            assert response.status_code == 404
            assert response.json()["error"] == "confrm-012"

            ###################################################################
            # Test getting / deleting / getting a key, should be pass, pass
            # fail - node key
            ###################################################################

            # Test retrieving deleted key (node)
            response = client.get("/config/" +
                                  "?key=key_a" +
                                  "&node_id=1:12:3:4")
            assert response.status_code == 200

            # Test deleting a config that does exist (node)
            response = client.delete("/config/" +
                                     "?key=key_a" +
                                     "&type=node" +
                                     "&id=1:12:3:4")
            assert response.status_code == 200

            # Test retrieving deleted key (node)
            response = client.get("/config/" +
                                  "?key=key_a" +
                                  "&node_id=1:12:3:4")
            assert response.status_code == 404
            assert response.json()["error"] == "confrm-012"


def test_put_node_title():
    """Tests changing the title of a given node"""

    with tempfile.TemporaryDirectory() as data_dir:
        config_file = os.path.join(data_dir, CONFIG_NAME)
        with open(config_file, "w") as file:
            file.write(get_config_file(data_dir))
        os.environ["CONFRM_CONFIG"] = config_file

        with TestClient(APP) as client:

            # Create a package for testing
            response = client.put("/package/" +
                                  "?name=package_a" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            # Create a node
            response = client.put("/register_node/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_a" +
                                  "&version=0.2.0" +
                                  "&description=some%20description" +
                                  "&platform=esp32")
            assert response.status_code == 200

            # Test default title is set to node id
            response = client.get("/nodes/" +
                                  "?node_id=0:12:3:4")
            assert response.status_code == 200
            assert response.json()["title"] == "0:12:3:4"

            # Test the setting the title for a node that does not exist
            response = client.put("/node_title/" +
                                  "?node_id=1:12:3:4" +
                                  "&title=Good%20Name")
            assert response.status_code == 400
            assert response.json()["error"] == "confrm-022"

            # Test with no node set
            response = client.put("/node_title/" +
                                  "?node_id=" +
                                  "&title=Good%20Name")
            assert response.status_code == 400
            assert response.json()["error"] == "confrm-022"

            # Test the setting a node title to an incorrect name
            response = client.put("/node_title/" +
                                  "?node_id=0:12:3:4" +
                                  "&title=Bad%20Name_that_is_very_much_far_too_long_and_should_" +
                                  "be_rejected_but_needs_to_be_over_80_chars_long")
            assert response.status_code == 400
            assert response.json()["error"] == "confrm-023"

            # Test default title is still set to node id
            response = client.get("/nodes/" +
                                  "?node_id=0:12:3:4")
            assert response.status_code == 200
            assert response.json()["title"] == "0:12:3:4"

            # Change title to correct value
            response = client.put("/node_title/" +
                                  "?node_id=0:12:3:4" +
                                  "&title=Good%20Name")
            assert response.status_code == 200

            # Check title was changed correctly
            response = client.get("/nodes/" +
                                  "?node_id=0:12:3:4")
            assert response.status_code == 200
            assert response.json()["title"] == "Good Name"


def test_register_node():
    """Tests registering a node"""

    with tempfile.TemporaryDirectory() as data_dir:
        config_file = os.path.join(data_dir, CONFIG_NAME)
        with open(config_file, "w") as file:
            file.write(get_config_file(data_dir))
        os.environ["CONFRM_CONFIG"] = config_file

        with TestClient(APP) as client:

            # Create a package
            response = client.put("/package/" +
                                  "?name=package_a" +
                                  "&description=some%20description" +
                                  "&title=Good%20Name" +
                                  "&platform=esp32")
            assert response.status_code == 201

            # Register a node with confrm
            response = client.put("/register_node/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_a" +
                                  "&version=" +
                                  "&description=some%20description" +
                                  "&platform=esp32")
            assert response.status_code == 200


            # Register a node with invalid id
            response = client.put("/register_node/" +
                                  "?node_id=*" +
                                  "&package=package_a" +
                                  "&version=" +
                                  "&description=some%20description" +
                                  "&platform=esp32")
            assert response.status_code == 400
