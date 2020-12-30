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
                                  "&name=package_a")
            assert response.status_code == 200
            assert response.json()["current_version"] == "0.1.0"

            # Force the next version to be a different package using canary feature
            response = client.put("/node_package/" +
                                  "?node_id=0:12:3:4" +
                                  "&package=package_b")
            assert response.status_code == 200

            # Check for update (will be a package with version 0.2.0)
            response = client.get("/check_for_update/" +
                                  "?node_id=0:12:3:4" +
                                  "&name=package_a")
            assert response.status_code == 200
            assert response.json()["current_version"] == "0.2.0"
            assert response.json()["force"]

# register_node
# nodes
# packages
# add_package
# package
# package_version (post)
# package version (delete)
# set_active_version
# blob
