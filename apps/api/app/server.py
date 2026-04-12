import os

from dotenv import load_dotenv
from flask import Flask

from .db import init_db
from .routes import api


def create_app() -> Flask:
    load_dotenv(override=False)

    app = Flask(__name__)

    db_path = os.environ.get("DATABASE_PATH", "./neuralops.sqlite3")
    init_db(db_path)

    app.register_blueprint(api)

    return app

