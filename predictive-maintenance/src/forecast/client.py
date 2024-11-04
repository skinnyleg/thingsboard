import websockets
import asyncio

TOKEN = "Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ0ZW5hbnRAdGhpbmdzYm9hcmQub3JnIiwidXNlcklkIjoiNTdiNWE2NzAtNjQ2ZC0xMWVmLThhMzEtMzViYjg2NWYzNTQ1Iiwic2NvcGVzIjpbIlRFTkFOVF9BRE1JTiJdLCJzZXNzaW9uSWQiOiJiOWIyZjJkYS0wMTFjLTRmYjUtOTVkOC1hNmMwZGI1ZThmMGEiLCJleHAiOjE3MzA3MzYyNTIsImlzcyI6InRoaW5nc2JvYXJkLmlvIiwiaWF0IjoxNzMwNzI3MjUyLCJlbmFibGVkIjp0cnVlLCJpc1B1YmxpYyI6ZmFsc2UsInRlbmFudElkIjoiNTcxYzI1OTAtNjQ2ZC0xMWVmLThhMzEtMzViYjg2NWYzNTQ1IiwiY3VzdG9tZXJJZCI6IjEzODE0MDAwLTFkZDItMTFiMi04MDgwLTgwODA4MDgwODA4MCJ9.ZrWClmTmfy6ZOp25B0oCecFEGWti3K32zylXTAkrVx2ZVe0q_CcDa22fAGsjZ9nTBQIyjqWP45iES2rWiVNlbg"

async def connect():
    uri = "ws://localhost:8000/forecast/8e911b00-953e-11ef-b3c9-21a45f1a724d/ws"
    async with websockets.connect(uri, extra_headers=[('x-authorization', TOKEN)]) as websocket:
        print("Connected")
        while True:
            response = await websocket.recv()
            print(response)

try:
    asyncio.run(connect())
except websockets.exceptions.ConnectionClosedOK:
    print("Connection closed")