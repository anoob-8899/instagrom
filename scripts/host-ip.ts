import os from "os";

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  url: string;
  isVirtual: boolean;
  type: "wifi" | "ethernet" | "virtual" | "other";
}

function isVirtualAdapter(name: string, address: string, mac?: string): boolean {
  const lowerName = name.toLowerCase();
  
  // Known virtual adapter names / drivers
  if (
    lowerName.includes("virtualbox") ||
    lowerName.includes("vbox") ||
    lowerName.includes("vmware") ||
    lowerName.includes("vethernet") ||
    lowerName.includes("wsl") ||
    lowerName.includes("hyper-v") ||
    lowerName.includes("bluetooth") ||
    lowerName.includes("loopback") ||
    lowerName.includes("tap") ||
    lowerName.includes("tailscale") ||
    lowerName.includes("zerotier") ||
    lowerName.includes("wireguard") ||
    lowerName.includes("npcap") ||
    lowerName.includes("docker") ||
    lowerName.includes("container") ||
    lowerName.includes("bridge") ||
    lowerName.includes("nat")
  ) {
    return true;
  }

  // VirtualBox Host-Only default subnet
  if (address.startsWith("192.168.56.")) {
    return true;
  }

  // VirtualBox MAC prefix (0a:00:27)
  if (mac && mac.toLowerCase().startsWith("0a:00:27")) {
    return true;
  }

  return false;
}

export function getLanAddresses(port: number = 3000): NetworkInterfaceInfo[] {
  const interfaces = os.networkInterfaces();
  const physicalAddresses: NetworkInterfaceInfo[] = [];
  const virtualAddresses: NetworkInterfaceInfo[] = [];

  for (const [name, netInterface] of Object.entries(interfaces)) {
    if (!netInterface) continue;
    for (const iface of netInterface) {
      // Filter for IPv4 and non-loopback
      if (iface.family === "IPv4" && !iface.internal) {
        // Exclude APIPA / self-assigned 169.254.x.x addresses
        if (iface.address.startsWith("169.254.")) {
          continue;
        }

        const isVirt = isVirtualAdapter(name, iface.address, iface.mac);
        let type: "wifi" | "ethernet" | "virtual" | "other" = "other";

        const lowerName = name.toLowerCase();
        if (isVirt) {
          type = "virtual";
        } else if (lowerName.includes("wi-fi") || lowerName.includes("wifi") || lowerName.includes("wlan") || lowerName.includes("wireless")) {
          type = "wifi";
        } else if (lowerName.includes("ethernet") || lowerName.includes("eth") || lowerName.includes("en0")) {
          type = "ethernet";
        }

        const info: NetworkInterfaceInfo = {
          name,
          address: iface.address,
          url: `http://${iface.address}:${port}`,
          isVirtual: isVirt,
          type,
        };

        if (isVirt) {
          virtualAddresses.push(info);
        } else {
          physicalAddresses.push(info);
        }
      }
    }
  }

  // Prioritize physical Wi-Fi first, then physical Ethernet, then other physical, then virtual
  physicalAddresses.sort((a, b) => {
    const priority = { wifi: 1, ethernet: 2, other: 3, virtual: 4 };
    return priority[a.type] - priority[b.type];
  });

  return [...physicalAddresses, ...virtualAddresses];
}

export function printHostLanInfo(port: number = 3000): void {
  const lanAddresses = getLanAddresses(port);
  const primaryLan = lanAddresses.find((a) => !a.isVirtual) || lanAddresses[0];

  console.log("\n================================================================");
  console.log("   INSTAGROM CLASSROOM SERVER");
  console.log("================================================================\n");
  console.log("Local:");
  console.log(`http://localhost:${port}\n`);

  if (primaryLan) {
    console.log("LAN:");
    console.log(`\x1b[32m\x1b[1m${primaryLan.url}\x1b[0m (${primaryLan.name})\n`);
    console.log("Other computers on the same Wi-Fi can connect using the LAN address.\n");
  } else {
    console.log("LAN:");
    console.log("  ⚠️  No active LAN/Wi-Fi IPv4 address detected!");
    console.log("  Please connect this computer to the classroom Wi-Fi router.\n");
  }

  if (lanAddresses.length > 1) {
    console.log("Detected Network Adapters:");
    lanAddresses.forEach(({ name, address, url, isVirtual, type }) => {
      const tag = isVirtual ? "[Virtual/VPN - Not LAN]" : `[${type.toUpperCase()}]`;
      console.log(`  • ${name}: ${address} -> ${url} ${tag}`);
    });
    console.log("");
  }

  console.log("Windows Firewall Setup (Run once as Administrator in PowerShell if needed):");
  console.log('  New-NetFirewallRule -DisplayName "INSTAGROM Classroom Server" `');
  console.log('    -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private\n');
  console.log("================================================================\n");
}

// Run directly if called as a script
if (require.main === module || process.argv[1]?.endsWith("host-ip.ts") || process.argv[1]?.endsWith("host-ip.js")) {
  printHostLanInfo(Number(process.env.PORT) || 3000);
}

