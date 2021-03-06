"""
Setup config for setuptools installation

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

import setuptools

setuptools.setup(
    name="confrm",
    version="1.0.0",
    description="IOT Package Deployment",
    python_requires=">=3.6",
    packages=setuptools.find_packages(exclude=["test", "doc"]),
    install_requires=["aiofiles",
                      "fastapi",
                      "markupsafe",
                      "pycryptodome",
                      "python-multipart",
                      "requests",
                      "tinydb",
                      "toml",
                      "uvicorn",
                      "zeroconf"],
    scripts=['confrm_srv'],
    classifiers=["Intended Audience :: Users",
                 "Natural Language :: English"
                 "Operating System :: OS Independent",
                 "Programming Language :: Python :: 3.6"],
    keywords="IOT deploy",
    include_package_data=True
)
