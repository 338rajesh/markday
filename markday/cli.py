"""CLI entry point for markday."""
import argparse
import webbrowser
import threading
import time
from .app import create_app


def main():
    parser = argparse.ArgumentParser(
        description="markday — local daily work logger"
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=5500, help="Port to bind (default: 5500)")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser automatically")
    parser.add_argument("--debug", action="store_true", help="Run Flask in debug mode")
    args = parser.parse_args()

    app = create_app()
    url = f"http://{args.host}:{args.port}"

    if not args.no_browser:
        def _open():
            time.sleep(0.8)
            webbrowser.open(url)
        threading.Thread(target=_open, daemon=True).start()

    print(f"  markday running → {url}")
    print("  Press Ctrl+C to stop.\n")
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
