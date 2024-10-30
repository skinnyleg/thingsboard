from typing import Dict, List, NewType, Union

Data = NewType("Data", Dict[str, List[Union[int, str]]])


def predict(tm_data: Data, forecastWindow: int) -> Data:
    # TODO: Implement forecast prediction
    # send back to the client forecast prediction of {forecastWindow} data points
    return tm_data
