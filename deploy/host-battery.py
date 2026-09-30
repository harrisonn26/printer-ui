#!/usr/bin/env python3
"""Publish the Klipper host's battery state to printer-ui.

Moonraker doesn't report batteries, so this reads Linux's power_supply class
and stores the result in each given Moonraker's database (namespace
`printer-ui`, key `host_battery`), where printer-ui reads it. Run it every
minute from cron:

    * * * * * /home/harrison/printer-ui/host-battery.py 7125 7126

Arguments are Moonraker ports on this host (default 7125). Exits quietly when
there's no battery or a Moonraker isn't reachable.
"""

import json
import sys
import time
import urllib.request
from pathlib import Path

POWER_SUPPLY = Path("/sys/class/power_supply")


def read(path: Path) -> str | None:
    try:
        return path.read_text().strip()
    except OSError:
        return None


def battery_state() -> dict | None:
    supplies = [entry for entry in POWER_SUPPLY.iterdir()] if POWER_SUPPLY.exists() else []
    batteries = [entry for entry in supplies if read(entry / "type") == "Battery"]
    if not batteries:
        return None
    battery = batteries[0]
    capacity = read(battery / "capacity")
    return {
        "capacity": int(capacity) if capacity and capacity.isdigit() else None,
        # Charging, Discharging, Full, Not charging, Unknown
        "status": read(battery / "status"),
        "ac": any(read(entry / "online") == "1" for entry in supplies if read(entry / "type") == "Mains"),
        "time": time.time(),
    }


def publish(port: int, value: dict) -> None:
    body = json.dumps({"namespace": "printer-ui", "key": "host_battery", "value": value}).encode()
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/server/database/item",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(request, timeout=5).close()
    except OSError as error:
        print(f"moonraker :{port}: {error}", file=sys.stderr)


def main() -> None:
    state = battery_state()
    if state is None:
        return
    for port in [int(arg) for arg in sys.argv[1:]] or [7125]:
        publish(port, state)


if __name__ == "__main__":
    main()
