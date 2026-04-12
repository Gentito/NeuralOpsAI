import os

from .server import create_app


def main() -> None:
    app = create_app()
    host = os.environ.get("API_HOST", "127.0.0.1")
    port = int(os.environ.get("API_PORT", "8000"))
    app.run(host=host, port=port, debug=True)


if __name__ == "__main__":
    main()

