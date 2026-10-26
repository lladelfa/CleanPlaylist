import os
from dotenv import load_dotenv
load_dotenv()

# test with auth code instead of generic client
print(os.environ.get("SPOTIFY_CLIENT_ID"))
