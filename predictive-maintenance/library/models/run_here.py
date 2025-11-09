#!/usr/bin/env python3
"""
Simple runner that you can execute from the models directory.
Just run: python run_here.py
"""

import subprocess
import sys
from pathlib import Path

# Go up to predictive-maintenance directory and run the main runner
predictive_maintenance_dir = Path(__file__).resolve().parent.parent.parent
runner_script = predictive_maintenance_dir / "run_anomaly_predictor.py"

# Run the runner script using subprocess
result = subprocess.run(
    [sys.executable, str(runner_script)],
    cwd=str(predictive_maintenance_dir)
)

sys.exit(result.returncode)
