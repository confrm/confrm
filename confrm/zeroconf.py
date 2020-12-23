import socket
from threading import Lock

from zeroconf import IPVersion, ServiceInfo, Zeroconf


class ConfrmZeroconf:

    mutex = Lock()
    services = []

    def __init__(self):

        self.mutex.acquire()
        try:
            self.zeroconf = Zeroconf(ip_version=IPVersion.V4Only)
        finally:
            self.mutex.release()

    def close(self):

        for service in self.services:
            self.zeroconf.unregister_service(service["info"])
        self.zeroconf.close()

    def register_package(self, name: str, platform: str):

        service_name = f"Confrm[{name}-{platform}]"
        service_info = ServiceInfo(
            "_" + service_name + "._arduino._tcp.local.",
            service_name + "._arduino._tcp.local.",
            addresses=[socket.inet_aton("127.0.0.1")],
            port=8266,
            properties={
                "tcp_check": "no",
                "ssh_upload": "no",
                "board": platform,
                "auth_upload": "no"
            },
            server=service_name + "._arduino._tcp.local.",
        )

        self.mutex.acquire()
        try:

            for service in self.services:
                if service["name"] == service_name:
                    #logging.error("Service already registered")
                    # TODO: Raise error here
                    return

            self.services.append({
                "name": service_name,
                "info": service_info
            })
            self.zeroconf.register_service(service_info)

        finally:

            self.mutex.release()

    def unregister_package(self, name: str, platform: str):

        service_name = f"Confrm[{name}-{platform}]"
        service_ind = -1
        for ind in range(0, len(self.services)):
            if self.services[ind]["name"] == service_name:
                service_ind = -1
                break

        if service_ind == -1:
            #logging.error("Service not registered")
            # TODO: Raise error here
            return

        self.mutex.acquire()
        try:
            self.zeroconf.unregister_service(
                self.services[service_ind]["info"])
            del self.services[service_ind]
        finally:
            self.mutex.release()
