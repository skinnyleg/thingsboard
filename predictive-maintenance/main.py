#
# Copyright © 2016-2024 The Thingsboard Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

import os
from fastapi import FastAPI
from src.forecast.forecast import router as forecast_router
from src.model.model import router as model_router
from src.notify import router as notify_router
from dotenv import load_dotenv
from src.settings import settings

# Load environment variables from .env file
load_dotenv()

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    root_path=settings.app_root_path,
    debug=settings.app_debug,
    title=settings.app_name,
    description=settings.app_description,
    version=settings.app_version,
)

origins = settings.cors_origins
# server shouldn't handle authentication in future, thingsboard should manage it

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast_router)
app.include_router(model_router)
app.include_router(notify_router)


@app.get("/health")
def health_check():
    """Health check endpoint for container monitoring"""
    # should check if all models are loaded and db connection is ok
    return {
        "status": "healthy",
        "service": "predictive-maintenance",
    }


@app.get("/api/predictiveMaintenance")
def read_root():
    ret = {"Hello": "World"}
    print("Predictive Maintenance API return", ret)
    return ret
