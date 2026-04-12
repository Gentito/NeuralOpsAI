import os

from dotenv import load_dotenv
from flask import Flask

from .store import init_store
from .routes import api


def create_app() -> Flask:
    load_dotenv(override=False)

    app = Flask(__name__)

    init_store()

    app.register_blueprint(api)

    return app
