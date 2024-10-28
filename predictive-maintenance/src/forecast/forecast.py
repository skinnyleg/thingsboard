from fastapi import APIRouter

router = APIRouter()

@router.patch("/{forecast_id}/activate")
async def update_forecast(forecast_id: str):
    ret = {"forecast_id": forecast_id, "status": "active"}
    print(f"Updated forecast {forecast_id} to active")
    return ret
