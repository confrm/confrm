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
        "pycroptodome",
        "python-multipart",
        "tinydb",
        "toml",
        "uvicorn"],
    scripts=['confrm'],
    classifiers=["Intended Audience :: Users",
                 "Natural Language :: English"
                 "Operating System :: OS Independent",
                 "Programming Language :: Python :: 3.6"],
    keywords="IOT deploy")
