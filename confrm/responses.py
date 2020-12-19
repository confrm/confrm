"""Custom FastAPI Response handler for sending data from memory as a file"""

from fastapi.responses import Response
from starlette.types import Receive, Scope, Send

class ConfrmFileResponse(Response):
    """Response class to enable files to be transfered from memory

    Builds on the FileResponse class in starlette.types.

    Attributes:
        data (bytes): Bytes array containing data to be transfered

    """

    chunk_size = 4096

    def __init__(self, data: bytes = None) -> None:
        """ Init method for ConfrmFileResponse class """

        self.data = data
        self.media_type = "application/octet-stream"
        self.init_headers(None)
        self.background = None
        self._headers_set = False

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """ Call method, overrides default method in FileResponse

        Sets HTTP headers, if not set, and then recursivley calls the send
        method to transfer data to TCP stack.

        """

        if self._headers_set is False:
            self._headers_set = True
            content_length = str(len(self.data))
            self.headers.setdefault("content-length", content_length)
            await send(
                {
                    "type": "http.response.start",
                    "status": 200,
                    "headers": self.raw_headers,
                }
        )

        more_body = True
        while more_body:
            chunk = self.data[0:self.chunk_size]
            self.data = self.data[self.chunk_size:]
            more_body = len(chunk) == self.chunk_size
            await send(
                {
                    "type": "http.response.body",
                    "body": chunk,
                    "more_body": more_body,
                }
            )
