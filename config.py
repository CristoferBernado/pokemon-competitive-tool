import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-123'
    POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2'
    POKEAPI_TIMEOUT = 10
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 3600
    ITEMS_PER_PAGE = 20
    SEARCH_RESULTS_PER_PAGE = 24
    DEBUG = True
    TESTING = False