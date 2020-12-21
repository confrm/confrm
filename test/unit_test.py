import os
import pytest
import tempfile

from fastapi.testclient import TestClient

from confrm import APP

CONFIG_NAME = "confrm.toml"


def get_config_file(path: str):
    """Returns a valid config file with data directroy set to input argument"""
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

def test_wrong_config():
    # Requires refactor of create_test_folder to take alternative data_dir...
    pass


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

            response = client.get("/package/?name=test_package")
            assert response.status_code == 200
            data = response.json()
            assert {"name", "description", "title", "platform"} <= data.keys()
            assert data["name"] == "test_package"
            assert data["description"] == "some description"
            assert data["title"] == "Good Name"
            assert data["platform"] == "esp32"

            response = client.put("/package/" +
                "?name=test_package" +
                "&description=some%20description" +
                "&title=Good%20Name" +
                "&platform=esp32")
            assert response.status_code == 400

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


# register_node
# nodes
# packages
# add_package
# package
# package_version (post)
# package version (delete)
# set_active_version
# blob
