import socket
import psutil
from typing import List, Dict, Optional

def get_lan_interfaces() -> List[Dict[str, str]]:
    results = []
    adapters = psutil.net_if_addrs()
    stats = psutil.net_if_stats()

    for iface_name, addrs in adapters.items():
        # Check if interface is up
        stat = stats.get(iface_name)
        if not stat or not stat.isup:
            continue

        lower_name = iface_name.lower()
        # Filter out virtual/loopback/vpn adapters
        if any(v in lower_name for v in ["loopback", "virtual", "vbox", "vmnet", "tailscale", "wsl", "hyper-v"]):
            continue

        for addr in addrs:
            if addr.family == socket.AF_INET:
                ip = addr.address
                # Filter out loopback and APIPA (169.254.x.x)
                if ip.startswith("127.") or ip.startswith("169.254."):
                    continue

                iface_type = "LAN"
                if "wi-fi" in lower_name or "wlan" in lower_name or "wireless" in lower_name:
                    iface_type = "Wi-Fi"
                elif "ethernet" in lower_name or "eth" in lower_name:
                    iface_type = "Ethernet"

                results.append({
                    "name": iface_name,
                    "ip": ip,
                    "type": iface_type,
                })

    return results

def get_primary_lan_ip() -> Optional[str]:
    interfaces = get_lan_interfaces()
    if not interfaces:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    wifi = next((i for i in interfaces if i["type"] == "Wi-Fi"), None)
    if wifi:
        return wifi["ip"]
    return interfaces[0]["ip"]

def print_lan_banner(port: int = 3000):
    primary_ip = get_primary_lan_ip()
    print("=" * 64)
    print("   INSTAGROM - PYTHON CLASSROOM LAN SERVER")
    print("=" * 64)
    print("\nLocal Host:")
    print(f"  -> http://localhost:{port}")
    print("\nClassroom LAN:")
    print(f"  -> http://{primary_ip}:{port}")
    print("\nOther computers on the same Wi-Fi / LAN can connect using the LAN address.")
    print("=" * 64 + "\n")

if __name__ == "__main__":
    print_lan_banner(3000)
