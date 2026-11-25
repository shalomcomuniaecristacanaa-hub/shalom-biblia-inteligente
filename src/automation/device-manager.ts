export type ManagedDevice = {
  id: string;
  name: string;
  kind: "vmix" | "agent" | "other";
  host: string;
  port: number;
  healthPath: string;
  enabled: boolean;
  lastStatus?: "online" | "offline" | "unknown";
  lastCheckedAt?: string;
  lastError?: string;
};

export type DeviceProbeResult = {
  id: string;
  online: boolean;
  checkedAt: string;
  statusCode?: number;
  error?: string;
};

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some(part => !/^\\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function normalizeDevice(input: any): ManagedDevice {
  const id = String(input?.id ?? "").trim();
  const name = String(input?.name ?? "").trim();
  const host = String(input?.host ?? "").trim();
  const port = Number(input?.port);
  const healthPath = String(input?.healthPath ?? "/health").trim();
  if (!id || !name) throw new Error("Informe um nome para o equipamento.");
  if (!isPrivateIpv4(host)) throw new Error("Use um IPv4 privado da rede local (10.x, 172.16–31.x ou 192.168.x).");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Informe uma porta válida (1–65535).");
  if (!healthPath.startsWith("/") || healthPath.startsWith("//") || /[\\r\\n]/.test(healthPath)) throw new Error("O caminho de saúde deve começar com / e ser um caminho local.");
  const kind = ["vmix", "agent", "other"].includes(input?.kind) ? input.kind : "other";
  return { id, name, kind, host, port, healthPath, enabled: input?.enabled !== false };
}

export async function probeDevice(device: ManagedDevice): Promise<DeviceProbeResult> {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`http://${device.host}:${device.port}${device.healthPath}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return { id: device.id, online: false, checkedAt, statusCode: response.status, error: `HTTP ${response.status}` };
    return { id: device.id, online: true, checkedAt, statusCode: response.status };
  } catch (error) {
    return {
      id: device.id,
      online: false,
      checkedAt,
      error: error instanceof Error && error.name === "AbortError" ? "Tempo limite de 4 segundos excedido." : (error instanceof Error ? error.message : String(error))
    };
  } finally {
    clearTimeout(timeout);
  }
}
