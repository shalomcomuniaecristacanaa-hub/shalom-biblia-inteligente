export type PexelsPhoto = { id: number; url: string; photographer: string; src: { large2x?: string; large?: string; original?: string } };
export type PexelsVideo = { id: number; url: string; image: string; user: { name: string }; video_files: Array<{ link: string; quality?: string; width?: number; height?: number }> };

const API = "https://api.pexels.com";

function authHeaders(apiKey: string) {
  if (!apiKey?.trim()) throw new Error("Configure a chave da API Pexels.");
  return { Authorization: apiKey };
}

export async function searchPhotos(query: string, apiKey: string): Promise<PexelsPhoto[]> {
  const url = new URL(`${API}/v1/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("per_page", "12");
  const response = await fetch(url, { headers: authHeaders(apiKey) });
  if (!response.ok) throw new Error(`Pexels fotos: HTTP ${response.status}`);
  const data = await response.json();
  return data.photos ?? [];
}

export async function searchVideos(query: string, apiKey: string): Promise<PexelsVideo[]> {
  const url = new URL(`${API}/videos/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("per_page", "12");
  const response = await fetch(url, { headers: authHeaders(apiKey) });
  if (!response.ok) throw new Error(`Pexels vídeos: HTTP ${response.status}`);
  const data = await response.json();
  return data.videos ?? [];
}
