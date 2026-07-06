#!/usr/bin/env python3
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class WorkbenchHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class WorkbenchServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 128


def main():
    handler = partial(WorkbenchHandler, directory="/Users/lume/base-model-workbench")
    server = WorkbenchServer(("0.0.0.0", 4173), handler)
    print("Serving Base Model Workbench on http://0.0.0.0:4173/index.html", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
