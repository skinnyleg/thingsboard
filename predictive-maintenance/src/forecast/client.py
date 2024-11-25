import websockets
import asyncio

TOKEN = "Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ0ZW5hbnRAdGhpbmdzYm9hcmQub3JnIiwidXNlcklkIjoiNTdiNWE2NzAtNjQ2ZC0xMWVmLThhMzEtMzViYjg2NWYzNTQ1Iiwic2NvcGVzIjpbIlRFTkFOVF9BRE1JTiJdLCJzZXNzaW9uSWQiOiIwY2Y1N2I5ZS00Y2E2LTRjOTgtYTU4My01NTBkZmY0ZTI4OTMiLCJleHAiOjE3MzE2MDAxMjksImlzcyI6InRoaW5nc2JvYXJkLmlvIiwiaWF0IjoxNzMxNTkxMTI5LCJlbmFibGVkIjp0cnVlLCJpc1B1YmxpYyI6ZmFsc2UsInRlbmFudElkIjoiNTcxYzI1OTAtNjQ2ZC0xMWVmLThhMzEtMzViYjg2NWYzNTQ1IiwiY3VzdG9tZXJJZCI6IjEzODE0MDAwLTFkZDItMTFiMi04MDgwLTgwODA4MDgwODA4MCJ9.NrSoYug36To5NqI0ooOTBLt25uyJaYIbXbJ5-5dp9sQwx2Xkj5xiKLeFurJlO5gfG491YmgK3uAzX4AvT2yMAA"

async def connect():
    uri = "ws://localhost:8000/forecast/19052230-a28d-11ef-94f9-a75de9592489/ws"
    async with websockets.connect(uri, extra_headers=[('x-authorization', TOKEN)]) as websocket:
        print("Connected")
        while True:
            response = await websocket.recv()
            print(response)

try:
    asyncio.run(connect())
except websockets.exceptions.ConnectionClosedOK:
    print("Connection closed")