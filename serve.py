#!/usr/bin/env python3
"""Static file server for mirofish.uichain.org.

Cloudflare Tunnel (com.mirofish.cloudflared) forwards mirofish.uichain.org
to http://localhost:3000, so this process must stay alive. It is managed by
launchd (com.mirofish.static) with KeepAlive=true: it restarts on crash and
starts at login.

Single file, zero dependencies, standard library only.
"""
import functools
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
PORT = 3000


class Handler(SimpleHTTPRequestHandler):
    """Serve ROOT, and map / to index.html."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        # "/" -> index.html is automatic; keep /guide -> guide.html working
        # even without the .html suffix.
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path.rstrip("/") in ("/guide", "/index"):
            self.path = path.rstrip("/") + ".html"
        super().do_GET()

    def log_message(self, fmt, *args):  # noqa: A003 - keep launchd log clean
        sys.stderr.write(
            "%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), fmt % args)
        )


def main():
    # Allow quick restart without waiting for TCP TIME_WAIT.
    ThreadingHTTPServer.allow_reuse_address = True
    handler = functools.partial(Handler)
    httpd = ThreadingHTTPServer((HOST, PORT), handler)
    sys.stderr.write(f"serving {ROOT} on http://{HOST}:{PORT}\n")
    sys.stderr.flush()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
