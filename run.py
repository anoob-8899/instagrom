import os
import sys
import uvicorn
from scripts.host_ip import print_lan_banner

def main():
    port = int(os.getenv("PORT", "3000"))
    host = os.getenv("HOST", "0.0.0.0")

    print_lan_banner(port)

    uvicorn.run(
        "instagrom.main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )

if __name__ == "__main__":
    main()
