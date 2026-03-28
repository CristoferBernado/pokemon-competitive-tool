from flask import Flask
from flask_caching import Cache
from config import Config

cache = Cache()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    cache.init_app(app)
    
    from .routes import main_bp
    app.register_blueprint(main_bp)
    
    return app