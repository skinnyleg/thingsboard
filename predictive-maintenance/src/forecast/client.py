import websockets
import asyncio

TOKEN = "Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJ0ZW5hbnRAdGhpbmdzYm9hcmQub3JnIiwidXNlcklkIjoiYTVmNWM2ODAtN2NiNC0xMWVmLTkyZWUtYzcxNzQxZjA4Yzg4Iiwic2NvcGVzIjpbIlRFTkFOVF9BRE1JTiJdLCJzZXNzaW9uSWQiOiI3MTc1N2M1My1iZTFkLTRkM2QtYjY3ZS05NTJhZjEwNGFhYmQiLCJleHAiOjE3MzI1NTI2OTksImlzcyI6InRoaW5nc2JvYXJkLmlvIiwiaWF0IjoxNzMyNTQzNjk5LCJlbmFibGVkIjp0cnVlLCJpc1B1YmxpYyI6ZmFsc2UsInRlbmFudElkIjoiYTViM2RiODAtN2NiNC0xMWVmLTkyZWUtYzcxNzQxZjA4Yzg4IiwiY3VzdG9tZXJJZCI6IjEzODE0MDAwLTFkZDItMTFiMi04MDgwLTgwODA4MDgwODA4MCJ9.hk0cK1Zwa-5X1m5MGQpjFc6RwL3OF4EjpO5F8layaFpCaCRy01GSxnmAuLBrtHxs58oYdmffKiB-2ppCYwVmMQ"

async def connect():
    uri = "ws://localhost:8000/forecast/82660610-ab37-11ef-925c-cfc4709cee8c/ws"
    async with websockets.connect(uri, additional_headers=[('x-authorization', TOKEN)]) as websocket:
        print("Connected")
        while True:
            response = await websocket.recv()
            print(response)

try:
    asyncio.run(connect())
except websockets.exceptions.ConnectionClosedOK:
    print("Connection closed")