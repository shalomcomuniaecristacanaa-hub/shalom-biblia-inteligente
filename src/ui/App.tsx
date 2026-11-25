import { useEffect, useMemo, useState } from "react";
import { onMessage, postMessage } from "@spresenter/plugin-sdk/ui";

type Verse = { id: string; reference: string; text: string; group: string; background: string; theme: string; book?: string };
type Output = { index: number; name?: string };
type Layer = { index: number; name?: string };
type ConnectionSettings = { grandmaIp: string; vmixIp: string };
type LightingGroup = { id: string; name: string; intensity: number; color: string; movement: string; colorBehavior: string; speed: number; strobe: number; grandmaGroup?: string; grandmaPositionPreset?: string };
type LightingScene = { id: string; name: string; preset: string; transition: number; groups: LightingGroup[] };
const defaultLightingGroups = (): LightingGroup[] => [
  { id: "front", name: "Frente", intensity: 100, color: "#ffffff", movement: "fixed", colorBehavior: "static", speed: 30, strobe: 0 },
  { id: "back", name: "Contra", intensity: 70, color: "#2878ff", movement: "fixed", colorBehavior: "static", speed: 30, strobe: 0 },
  { id: "moving", name: "Moving Heads", intensity: 50, color: "#8b35e8", movement: "sweep", colorBehavior: "static", speed: 45, strobe: 0 },
  { id: "led", name: "Painel LED", intensity: 80, color: "#15d6dc", movement: "fixed", colorBehavior: "wave", speed: 45, strobe: 0 }
];
const lightingPresets = [
  { id: "wave", name: "Onda LED", description: "Cores percorrem os LEDs em sequência", movement: "fixed", colorBehavior: "wave", color: "#168cff" },
  { id: "rainbow", name: "Ciclo de cores", description: "Alternância contínua de cores", movement: "fixed", colorBehavior: "rainbow", color: "#8b35e8" },
  { id: "flash", name: "Piscas", description: "Pulsos rápidos de luz", movement: "fixed", colorBehavior: "static", color: "#ffffff", strobe: 65 },
  { id: "pulse", name: "Pulso suave", description: "Intensidade aumenta e diminui", movement: "fixed", colorBehavior: "pulse", color: "#2878ff" },
  { id: "sweep", name: "Varredura", description: "Movimento lateral dos moving heads", movement: "sweep", colorBehavior: "static", color: "#8b35e8" },
  { id: "circle", name: "Movimento circular", description: "Movimento circular dos moving heads", movement: "circle", colorBehavior: "static", color: "#15d6dc" },
  { id: "chase", name: "Perseguição", description: "Grupos acendem em sequência", movement: "fixed", colorBehavior: "chase", color: "#ffb02e" },
  { id: "warm", name: "Culto / Palavra", description: "Luz quente e estável", movement: "fixed", colorBehavior: "static", color: "#ffbd72" }
];

const blankConnections = (): ConnectionSettings => ({ grandmaIp: "", vmixIp: "" });
type EventSchedule = { id: string; name: string; date: string; time: string; coverGuid: string; song: string; grandmaCommand: string; vmixFunction: string; startStream: boolean; enabled: boolean };
const blankSchedule = (): EventSchedule => ({ id: "", name: "", date: "", time: "", coverGuid: "", song: "", grandmaCommand: "", vmixFunction: "", startStream: false, enabled: true });
const blank = (): Verse => ({ id: "", reference: "", text: "", group: "Geral", background: "", theme: "", book: "" });
function sectionBody(section: any): string {
  const value = section?.text ?? section?.content ?? section?.lyrics ?? section?.value ?? "";
  if (Array.isArray(value)) return value.map(item => typeof item === "string" ? item : String(item?.text ?? "")).filter(Boolean).join("\\n");
  return typeof value === "string" ? value : "";
}

export function App() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [verse, setVerse] = useState<Verse>(blank());
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Todas");
  const [output, setOutput] = useState("0");
  const [contentLayer, setContentLayer] = useState("0");
  const [backgroundLayer, setBackgroundLayer] = useState("1");
  const [captureLayer, setCaptureLayer] = useState("0");
  const [tab, setTab] = useState<"dashboard" | "scheduler" | "live" | "library" | "favorites" | "add" | "settings" | "lighting">("dashboard");
  const [bibleReference, setBibleReference] = useState("");
  const [bibleVersion, setBibleVersion] = useState("nvi");
  const bibleVersions = [
    { id: "nvi", name: "NVI — Nova Versão Internacional" },
    { id: "nvt", name: "NVT — Nova Versão Transformadora" },
    { id: "ntlh", name: "NTLH — Nova Tradução na Linguagem de Hoje" },
    { id: "acf", name: "ACF — Almeida Corrigida Fiel" },
    { id: "aa", name: "AA — Almeida Atualizada" },
    { id: "blivre", name: "BLivre — Bíblia Livre" },
    { id: "alm1911", name: "ALM1911 — Almeida 1911" },
    { id: "ol", name: "OL — O Livro" },
    { id: "mens", name: "MENS — A Mensagem" },
    { id: "as21", name: "AS21 — Almeida Século 21" }
  ];
  const [bibleResult, setBibleResult] = useState<any | null>(null);
  const [bibleStatus, setBibleStatus] = useState("");
  const [songQuery, setSongQuery] = useState("");
  const [songs, setSongs] = useState<any[]>([]);
  const [songSearchSource, setSongSearchSource] = useState<"local" | "online" | "">("");
  const [songSearchStatus, setSongSearchStatus] = useState("");
  const [songSections, setSongSections] = useState<Record<string, any[]>>({});
  const [messageText, setMessageText] = useState("");
  const [searchingSongs, setSearchingSongs] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<any[]>([]);
  const [selectedBackgroundGuid, setSelectedBackgroundGuid] = useState("");
  const [lastSentBackgroundAsset, setLastSentBackgroundAsset] = useState<any | null>(null);
  const [lastSentSongSection, setLastSentSongSection] = useState<{ guid: string; index: number } | null>(null);
  const [libraryType, setLibraryType] = useState("all");
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [contextVerse, setContextVerse] = useState<string | null>(null);
  const [groupBackgrounds, setGroupBackgrounds] = useState({ Ceia: "", Palavra: "", "Dízimo": "" });
  const [backgroundCategory, setBackgroundCategory] = useState("Palavra");
  const [eventSchedules, setEventSchedules] = useState<EventSchedule[]>([]);
  const [scheduleDraft, setScheduleDraft] = useState<EventSchedule>(blankSchedule());
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>(blankConnections());
  const [grandmaTelnet, setGrandmaTelnet] = useState({ username: "", password: "" });
  const [grandmaTelnetPort, setGrandmaTelnetPort] = useState("30000");
  const [grandmaBridgeStatus, setGrandmaBridgeStatus] = useState("Ponte local não testada");
  const [grandmaCommand, setGrandmaCommand] = useState("List Group Thru 10");
  const [grandmaResponse, setGrandmaResponse] = useState("");
  const [grandmaCatalog, setGrandmaCatalog] = useState<{name:string;response:string}[]>([]);
  const [grandmaSequenceNumber, setGrandmaSequenceNumber] = useState("90");
  const [grandmaSceneName, setGrandmaSceneName] = useState("Nova cena Shalom");
  const [grandmaPresetType, setGrandmaPresetType] = useState("4");
  const [grandmaPresetNumber, setGrandmaPresetNumber] = useState("1");
  const [grandmaSavePreset, setGrandmaSavePreset] = useState(false);
  const [grandmaCatalogLoading, setGrandmaCatalogLoading] = useState(false);
  const [grandmaSelectedLightingSceneId, setGrandmaSelectedLightingSceneId] = useState("");
  const [grandmaImportedXmlName, setGrandmaImportedXmlName] = useState("");
  const [grandmaImportedObjects, setGrandmaImportedObjects] = useState<{kind:string;name:string;number:string}[]>([]);
  const [grandmaImportStatus, setGrandmaImportStatus] = useState("");
  const bridgeRequest = async (path: string, body?: unknown) => {
    const response = await fetch("http://127.0.0.1:17842" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Falha na ponte local");
    return result;
  };
  const configureGrandmaBridge = async () => {
    try {
      if (!connectionSettings.grandmaIp.trim()) throw new Error("Informe o IP da GrandMA2.");
      const port = Number(grandmaTelnetPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Informe uma porta Telnet válida.");
      await bridgeRequest("/configure", { host: connectionSettings.grandmaIp.trim(), port, username: grandmaTelnet.username.trim() || "administrator", password: grandmaTelnet.password });
      setGrandmaBridgeStatus("Credenciais configuradas na ponte local (em memória).");
      setNotice("Configuração Telnet enviada à ponte local.");
    } catch (e) { setGrandmaBridgeStatus(e instanceof Error ? e.message : String(e)); }
  };
  const testGrandmaBridge = async () => {
    try {
      const result = await bridgeRequest("/connect", {});
      setGrandmaBridgeStatus(result.loggedIn ? "Conectada e autenticada" : "Socket conectado; autenticação ainda não confirmada");
    } catch (e) { setGrandmaBridgeStatus(e instanceof Error ? e.message : String(e)); }
  };
  const sendGrandmaCommand = async () => {
    try {
      const result = await bridgeRequest("/command", { command: grandmaCommand });
      setGrandmaResponse(String(result.response || ""));
      setGrandmaBridgeStatus("Comando enviado; resposta recebida.");
    } catch (e) { setGrandmaBridgeStatus(e instanceof Error ? e.message : String(e)); }
  };

  const readGrandmaCatalog = async () => {
    const presetTypes = [
      {id:1,name:"Dimmer"},{id:2,name:"Position"},{id:3,name:"Gobo"},{id:4,name:"Color"},
      {id:5,name:"Beam"},{id:6,name:"Focus"},{id:7,name:"Shapers"},{id:8,name:"Video"},
      {id:9,name:"Control"},{id:10,name:"Sound"},{id:11,name:"Media"},{id:12,name:"3D"}
    ];
    const queries = [
      {name:"Grupos",command:"List Group"},
      ...presetTypes.map(p=>({name:"Presets · "+p.id+" · "+p.name,command:"List Preset "+p.id})),
      {name:"Sequências / cenas",command:"List Sequence"},
      {name:"Macros",command:"List Macro"}
    ];
    const results: {name:string;response:string}[] = [];
    setGrandmaCatalogLoading(true);
    try {
      setGrandmaBridgeStatus("Lendo grupos, 12 tipos de preset, sequências e macros...");
      for (const item of queries) {
        const result = await bridgeRequest("/command", {command:item.command});
        const raw = String(result.response || "").trim();
        const empty = /NO OBJECTS FOUND|NO OBJECTS|nenhum objeto/i.test(raw);
        results.push({name:item.name,response:empty ? "Nenhum objeto cadastrado nesta categoria.\n\n"+raw : raw || "A mesa não retornou linhas para esta consulta."});
        setGrandmaCatalog([...results]);
      }
      setGrandmaBridgeStatus("Leitura concluída: "+results.length+" consultas. Categorias vazias foram identificadas separadamente.");
    } catch (e) {
      setGrandmaCatalog(results);
      setGrandmaBridgeStatus(e instanceof Error ? e.message : String(e));
    } finally { setGrandmaCatalogLoading(false); }
  };
  const createGrandmaScene = async () => {
    const n = Number(grandmaSequenceNumber);
    const pn = Number(grandmaPresetNumber);
    const pt = Number(grandmaPresetType);
    const cleanName = grandmaSceneName.trim();
    if (!Number.isInteger(n) || n < 1 || n > 9999 || !cleanName || /["\r\n]/.test(cleanName)) {
      setGrandmaBridgeStatus("Informe número de Sequence válido e nome sem aspas/quebras de linha."); return;
    }
    if (grandmaSavePreset && (!Number.isInteger(pn) || pn < 1 || pn > 9999 || !Number.isInteger(pt) || pt < 1 || pt > 12)) {
      setGrandmaBridgeStatus("Informe tipo e número de preset válidos."); return;
    }
    try {
      setGrandmaBridgeStatus("Verificando se os números escolhidos estão livres...");
      const sequenceCheck = await bridgeRequest("/command", {command:"List Sequence "+n});
      const sequenceText = String(sequenceCheck.response || "");
      if (!/NO OBJECTS FOUND|NO OBJECTS|nenhum objeto/i.test(sequenceText)) {
        setGrandmaBridgeStatus("A Sequence "+n+" já existe ou não foi possível confirmar que está livre. Nada foi gravado.");
        setGrandmaResponse(sequenceText); return;
      }
      if (grandmaSavePreset) {
        const presetCheck = await bridgeRequest("/command", {command:"List Preset "+pt+"."+pn});
        const presetText = String(presetCheck.response || "");
        if (!/NO OBJECTS FOUND|NO OBJECTS|nenhum objeto/i.test(presetText)) {
          setGrandmaBridgeStatus("O preset "+pt+"."+pn+" já existe ou não foi possível confirmar que está livre. Nada foi gravado.");
          setGrandmaResponse(presetText); return;
        }
      }
      const presetNote = grandmaSavePreset ? "\nTambém será criado o preset "+pt+"."+pn+"." : "";
      if (!window.confirm("Ação de gravação:\n• Salvar valores atuais do Programmer como Cue 1 da Sequence "+n+".\n• Nome: "+cleanName+"."+presetNote+"\n\nConfirme que os aparelhos/valores estão preparados. Deseja continuar?")) return;
      const sequenceStore = await bridgeRequest("/command", {command:"Store Cue 1 Sequence "+n});
      const sequenceLabel = await bridgeRequest("/command", {command:'Label Sequence '+n+' "'+cleanName+'"'});
      const responses = ["Sequence "+n+": "+String(sequenceStore.response || "Store enviado."),String(sequenceLabel.response || "Nome enviado.")];
      if (grandmaSavePreset) {
        const presetStore = await bridgeRequest("/command", {command:"Store Preset "+pt+"."+pn});
        const presetLabel = await bridgeRequest("/command", {command:'Label Preset '+pt+"."+pn+' "'+cleanName+'"'});
        responses.push("Preset "+pt+"."+pn+": "+String(presetStore.response || "Store enviado."),String(presetLabel.response || "Nome enviado."));
      }
      setGrandmaResponse(responses.join("\n\n"));
      setGrandmaBridgeStatus("Cadastro enviado. Confira Sequence"+(grandmaSavePreset?" e Preset":"")+" na tela da GrandMA2. Nenhum Go foi executado.");
      await readGrandmaCatalog();
    } catch (e) { setGrandmaBridgeStatus(e instanceof Error ? e.message : String(e)); }
  };

  const [lightingGroups, setLightingGroups] = useState<LightingGroup[]>(defaultLightingGroups());
  const [lightingScenes, setLightingScenes] = useState<LightingScene[]>([]);
  const [lightingName, setLightingName] = useState("Nova cena");
  const [lightingPreset, setLightingPreset] = useState("custom");
  const [lightingTransition, setLightingTransition] = useState(3);

  const importGrandmaXml = async (file?: File) => {
    if (!file) return;
    if (!/\\.xml$/i.test(file.name)) { setGrandmaImportStatus("Selecione um arquivo XML exportado pela GrandMA2. Arquivos .show completos ainda não são importados diretamente."); return; }
    if (file.size > 10 * 1024 * 1024) { setGrandmaImportStatus("O XML deve ter até 10 MB para análise no plugin."); return; }
    try {
      const source = await file.text();
      if (!source.trim() || /<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("XML vazio ou com declarações externas não permitidas.");
      const documentXml = new DOMParser().parseFromString(source, "application/xml");
      if (documentXml.querySelector("parsererror")) throw new Error("O arquivo não contém um XML válido.");
      const relevant = /group|preset|sequence|cue|macro|effect|executor|fixture/i;
      const found: {kind:string;name:string;number:string}[] = [];
      for (const element of Array.from(documentXml.getElementsByTagName("*"))) {
        const tag = element.tagName.split(":").pop() || element.tagName;
        if (!relevant.test(tag)) continue;
        const attrs = element as Element;
        const childName = Array.from(element.children).find(child => /^name$/i.test(child.tagName.split(":").pop() || child.tagName));
        const name = attrs.getAttribute("name") || attrs.getAttribute("Name") || childName?.textContent?.trim() || "";
        const number = attrs.getAttribute("number") || attrs.getAttribute("Number") || attrs.getAttribute("no") || attrs.getAttribute("No") || attrs.getAttribute("id") || attrs.getAttribute("ID") || "";
        if (name || number) found.push({kind:tag,name:name || "(sem nome)",number});
        if (found.length >= 500) break;
      }
      setGrandmaImportedXmlName(file.name);
      setGrandmaImportedObjects(found);
      setGrandmaImportStatus(found.length
        ? "Leitura concluída: "+found.length+" referências encontradas. Confira a prévia; nenhum dado foi enviado ou gravado na mesa."
        : "XML válido, mas não encontrei objetos reconhecíveis. Exporte os objetos pelo menu XML da GrandMA2 e tente novamente.");
    } catch (error) {
      setGrandmaImportedXmlName("");
      setGrandmaImportedObjects([]);
      setGrandmaImportStatus(error instanceof Error ? error.message : "Falha ao analisar o XML.");
    }
  };

  const sendSavedLightingSceneToGrandma = async () => {
    const scene = lightingScenes.find(item => item.id === grandmaSelectedLightingSceneId);
    const sequence = Number(grandmaSequenceNumber);
    if (!scene) { setGrandmaBridgeStatus("Selecione uma cena salva no simulador."); return; }
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) { setGrandmaBridgeStatus("Informe um número de Sequence válido."); return; }
    const mapped = scene.groups.map(group => ({group, maGroup:Number(group.grandmaGroup)}));
    const missing = mapped.filter(item => !Number.isInteger(item.maGroup) || item.maGroup < 1 || item.maGroup > 9999);
    if (missing.length) {
      setGrandmaBridgeStatus("Configure o número do Group da GrandMA2 para: "+missing.map(item=>item.group.name).join(", ")+". Faça isso no Estúdio de Iluminação e salve a cena novamente.");
      return;
    }
    const commands:string[] = [];
    for (const item of mapped) {
      const hex = String(item.group.color || "#ffffff").replace("#","");
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) { setGrandmaBridgeStatus("Cor inválida no grupo "+item.group.name+"."); return; }
      const r = Math.round(parseInt(hex.slice(0,2),16)/255*100);
      const g = Math.round(parseInt(hex.slice(2,4),16)/255*100);
      const b = Math.round(parseInt(hex.slice(4,6),16)/255*100);
      commands.push("Group "+item.maGroup+" At Dimmer "+Math.max(0,Math.min(100,Math.round(item.group.intensity))));
      commands.push('Group '+item.maGroup+' At Attribute "ColorRGB1" At '+r);
      commands.push('Group '+item.maGroup+' At Attribute "ColorRGB2" At '+g);
      commands.push('Group '+item.maGroup+' At Attribute "ColorRGB3" At '+b);
      const positionPreset = Number(item.group.grandmaPositionPreset);
      if (item.group.movement !== "fixed" && Number.isInteger(positionPreset) && positionPreset > 0 && positionPreset <= 9999) {
        commands.push("Group "+item.maGroup+" At Preset 2."+positionPreset);
      }
    }
    try {
      setGrandmaBridgeStatus("Verificando Sequence "+sequence+" e preparando "+commands.length+" comandos de iluminação...");
      const check = await bridgeRequest("/command",{command:"List Sequence "+sequence});
      const checkText = String(check.response || "");
      if (!/NO OBJECTS FOUND|NO OBJECTS|nenhum objeto/i.test(checkText)) {
        setGrandmaResponse(checkText);
        setGrandmaBridgeStatus("A Sequence "+sequence+" já existe ou não foi possível confirmar que está livre. Nada foi enviado.");
        return;
      }
      const dynamic = scene.groups.filter(group=>group.colorBehavior!=="static" || group.strobe>0 || (group.movement!=="fixed" && !Number.isInteger(Number(group.grandmaPositionPreset))));
      const dynamicNote = dynamic.length ? "\n\nAtenção: onda/ciclo/pulso/perseguição e estrobo da prévia ainda exigem efeitos/macros MA2. Movimento só será aplicado quando houver um preset Position da mesa informado no grupo. A cor RGB exige aparelhos com atributos ColorRGB; fixtures com roda de cor precisam de preset Color já cadastrado na mesa." : "";
      if (!window.confirm("Enviar a cena salva \""+scene.name+"\" para a GrandMA2?\\n\\nSerá aplicado no Programmer: "+mapped.map(item=>item.group.name+" → Group "+item.maGroup).join("\\n")+".\\nDepois será gravada como Cue 1 da Sequence "+sequence+"."+dynamicNote+"\\n\\nConfirme que os Groups estão mapeados corretamente e que a mesa está em modo de teste.")) return;
      const replies:string[] = [];
      for (const command of commands) {
        const result = await bridgeRequest("/command",{command});
        replies.push("> "+command+"\n"+String(result.response || "Comando aceito; sem texto de retorno."));
      }
      const store = await bridgeRequest("/command",{command:"Store Cue 1 Sequence "+sequence});
      replies.push("> Store Cue 1 Sequence "+sequence+"\n"+String(store.response || "Comando enviado."));
      const label = await bridgeRequest("/command",{command:'Label Sequence '+sequence+' "'+String(scene.name).replace(/["\\r\\n]/g,"").slice(0,48)+'"'});
      replies.push("> Label Sequence "+sequence+"\n"+String(label.response || "Nome enviado."));
      setGrandmaResponse(replies.join("\n\n"));
      setGrandmaBridgeStatus("Cena \""+scene.name+"\" transferida para o Programmer e cadastro enviado à Sequence "+sequence+". Confira na GrandMA2; nenhum Go foi executado.");
      await readGrandmaCatalog();
    } catch (e) { setGrandmaBridgeStatus(e instanceof Error ? e.message : String(e)); }
  };


  useEffect(() => {
    const off = onMessage(raw => {
      const m = raw as any;
      if (m.type === "state") {
        setVerses(m.verses ?? []); setOutputs(m.outputs ?? []); setLayers(m.layers ?? []); setEventSchedules(m.eventSchedules ?? []); setConnectionSettings(m.connectionSettings ?? blankConnections()); setLightingScenes(m.lightingScenes ?? []); setGroupBackgrounds(m.groupBackgrounds ?? { Ceia: "", Palavra: "", "Dízimo": "" });
        const ls = (m.layers ?? []) as Layer[];
        const content = ls.find(l => /conte[uú]do/i.test(l.name ?? ""));
        const bg = ls.find(l => /fundo|background/i.test(l.name ?? ""));
        if (content) { setContentLayer(String(content.index)); setCaptureLayer(String(content.index)); }
        if (bg) setBackgroundLayer(String(bg.index));
        if ((m.outputs ?? []).length) setOutput(String(m.outputs[0].index));
        postMessage({ type: "watch-bible", output: String((m.outputs ?? [])[0]?.index ?? 0), captureLayer: content?.index ?? 0 });
      }
      if (m.type === "captured") {
        setVerse(v => ({ ...v, reference: m.reference || "", book: m.book || "", text: m.text || "" }));
        setTab("add"); setNotice("Versículo da Bíblia do SPresenter atualizado automaticamente na prévia.");
      }
      if (m.type === "presented") {
        setNotice(m.background === "error" ? "Versículo apresentado. " + m.message : "Apresentado: " + (m.reference || m.message || "Conteúdo enviado"));
        if (m.guid && Number.isInteger(m.index)) setLastSentSongSection({ guid: m.guid, index: m.index });
      }
      if (m.type === "songs-found") {
        const localSongs = m.songs ?? [];
        if (localSongs.length) {
          setSongs(localSongs); setSongSearchSource("local"); setSongSearchStatus("Encontrado na biblioteca local do SPresenter."); setSearchingSongs(false);
        } else {
          setSongs([]); setSongSearchSource("online"); setSongSearchStatus("Não encontrado localmente. Procurando no catálogo online…");
          const term = String(m.query ?? "").trim();
          if (term) {
            const callbackName = "__shalomMusicSearch_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
            const script = document.createElement("script");
            let timeout: number;
            const cleanup = () => {
              window.clearTimeout(timeout);
              script.remove();
              delete (window as any)[callbackName];
            };
            (window as any)[callbackName] = (payload: any) => {
              cleanup();
              const results = (payload.results ?? []).map((item: any) => ({
                guid: String(item.trackId), title: item.trackName, artist: item.artistName,
                album: item.collectionName, url: item.trackViewUrl, artwork: item.artworkUrl100,
                online: true
              }));
              setSongs(results);
              setSongSearchStatus(results.length ? "Resultados encontrados no catálogo online. Abra a loja para ouvir ou conferir." : "Não encontramos esse louvor no catálogo online. Tente título ou artista.");
              setSearchingSongs(false);
            };
            script.onerror = () => {
              cleanup(); setSongSearchStatus("Não foi possível acessar a busca online. Verifique a conexão e as permissões de rede do SPresenter."); setSearchingSongs(false);
            };
            script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=br&media=music&entity=song&limit=12&callback=${callbackName}`;
            timeout = window.setTimeout(() => {
              cleanup(); setSongSearchStatus("A busca online demorou demais. Tente novamente."); setSearchingSongs(false);
            }, 12000);
            document.head.appendChild(script);
          } else { setSearchingSongs(false); }
        }
      }
      if (m.type === "library-found") {
        const assets = m.assets ?? [];
        setLibraryAssets(assets); setLoadingLibrary(false);
        const firstVisual = assets.find((asset: any) => ["image", "video", "backgroundvideo", "motion", "motionbackground", "animatedbackground", "worshipwide"].includes(String(asset.type ?? "").toLowerCase()) || String(asset.guid ?? "").startsWith("worshipwide/"));
        if (firstVisual) setSelectedBackgroundGuid((current: string) => current || firstVisual.guid);
      }
      if (m.type === "background-presented") {
        setLastSentBackgroundAsset({ guid: m.guid, title: m.title });
        setNotice(m.message || "Fundo local enviado.");
      }
      if (m.type === "song-sections") setSongSections(v => ({ ...v, [m.guid]: m.sections ?? [] }));
      if (m.type === "notice" || m.type === "error") setNotice(m.message);
      if (m.type === "error") setBusy(false);
      if (m.type === "presented") setBusy(false);
    });
    postMessage({ type: "init" });
    return off;
  }, []);

  useEffect(() => {
    const clock = window.setInterval(() => setClockNow(Date.now()), 15000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    const handleLiveShortcut = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "F10") {
        event.preventDefault();
        postMessage({ type: "clear-content", output, contentLayer });
        setNotice("Letra / conteúdo removido do telão (F10).");
      } else if (event.key === "F11") {
        event.preventDefault();
        postMessage({ type: "clear-background", output, backgroundLayer });
        setNotice("Fundo removido do telão (F11).");
      }
    };
    window.addEventListener("keydown", handleLiveShortcut);
    return () => window.removeEventListener("keydown", handleLiveShortcut);
  }, [output, contentLayer, backgroundLayer]);

  useEffect(() => {
    const reference = bibleReference.trim();
    if (!reference) { setBibleResult(null); setBibleStatus(""); return; }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setBibleStatus("Buscando texto bíblico…");
      try {
        const match = reference.match(/^(.+?)\s+(\d{1,3})(?:\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?$/);
        if (!match) throw new Error("Use Livro capítulo:versículo, por exemplo João 3:16 ou João 3:16-17.");
        const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");
        const books: Array<[string,string,string[]]> = [
          ["Gênesis","gn",["genesis","gen"]],["Êxodo","ex",["exodo","exodus"]],["Levítico","lv",["levitico","lev"]],["Números","nm",["numeros","num"]],["Deuteronômio","dt",["deuteronomio","deut"]],["Josué","js",["josue"]],["Juízes","jz",["juizes"]],["Rute","rt",["rute"]],["1 Samuel","1sm",["1samuel","i samuel"]],["2 Samuel","2sm",["2samuel","ii samuel"]],["1 Reis","1rs",["1reis","i reis"]],["2 Reis","2rs",["2reis","ii reis"]],["1 Crônicas","1cr",["1cronicas","i cronicas"]],["2 Crônicas","2cr",["2cronicas","ii cronicas"]],["Esdras","ed",["esdras"]],["Neemias","ne",["neemias"]],["Ester","et",["ester"]],["Jó","job",["jo","job"]],["Salmos","sl",["salmo","salmos"]],["Provérbios","pv",["proverbios"]],["Eclesiastes","ec",["eclesiastes"]],["Cânticos","ct",["canticos","cantares"]],["Isaías","is",["isaias"]],["Jeremias","jr",["jeremias"]],["Lamentações","lm",["lamentacoes"]],["Ezequiel","ez",["ezequiel"]],["Daniel","dn",["daniel"]],["Oséias","os",["oseias"]],["Joel","jl",["joel"]],["Amós","am",["amos"]],["Obadias","ob",["obadias"]],["Jonas","jn",["jonas"]],["Miquéias","mq",["miqueias"]],["Naum","na",["naum"]],["Habacuque","hc",["habacuque"]],["Sofonias","sf",["sofonias"]],["Ageu","ag",["ageu"]],["Zacarias","zc",["zacarias"]],["Malaquias","ml",["malaquias"]],["Mateus","mt",["mateus"]],["Marcos","mc",["marcos"]],["Lucas","lc",["lucas"]],["João","jo",["joao"]],["Atos","at",["atos"]],["Romanos","rm",["romanos"]],["1 Coríntios","1co",["1corintios","i corintios"]],["2 Coríntios","2co",["2corintios","ii corintios"]],["Gálatas","gl",["galatas"]],["Efésios","ef",["efesios"]],["Filipenses","fp",["filipenses"]],["Colossenses","cl",["colossenses"]],["1 Tessalonicenses","1ts",["1tessalonicenses","i tessalonicenses"]],["2 Tessalonicenses","2ts",["2tessalonicenses","ii tessalonicenses"]],["1 Timóteo","1tm",["1timoteo","i timoteo"]],["2 Timóteo","2tm",["2timoteo","ii timoteo"]],["Tito","tt",["tito"]],["Filemom","fm",["filemom"]],["Hebreus","hb",["hebreus"]],["Tiago","tg",["tiago"]],["1 Pedro","1pe",["1pedro","i pedro"]],["2 Pedro","2pe",["2pedro","ii pedro"]],["1 João","1jo",["1joao","i joao"]],["2 João","2jo",["2joao","ii joao"]],["3 João","3jo",["3joao","iii joao"]],["Judas","jd",["judas"]],["Apocalipse","ap",["apocalipse"]]
        ];
        const book = books.find(([name,,aliases]) => [name,...aliases].some(alias => normalize(alias) === normalize(match[1])));
        if (!book) throw new Error("Não reconheci esse livro bíblico. Confira a referência.");
        const chapter = Number(match[2]), first = Number(match[3] || 1), last = Number(match[4] || first);
        if (chapter < 1 || first < 1 || last < first || last-first > 5) throw new Error("Informe até seis versículos por consulta.");
        const response = await window.fetch(`https://abibliadigital.api.br/api/verses/${bibleVersion}/${book[1]}/${chapter}`);
        if (!response.ok) throw new Error("A fonte bíblica não respondeu. Verifique sua conexão e tente novamente.");
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : (payload.verses || payload.data?.verses || []);
        const selected = rows.filter((item: any) => Number(item.number) >= first && Number(item.number) <= last);
        if (!selected.length || selected.length !== last-first+1) throw new Error("Não encontrei todos os versículos. Confira capítulo e numeração.");
        const text = selected.map((item: any) => `${item.number}. ${String(item.text || "").replace(/<[^>]*>/g," ").trim()}`).join("\n");
        if (!cancelled) { setBibleResult({reference:`${book[0]} ${chapter}:${first}${last>first?"-"+last:""}`,book:book[0],text}); setBibleStatus(""); }
      } catch (error) {
        if (!cancelled) { setBibleResult(null); setBibleStatus(error instanceof Error ? error.message : "Não foi possível consultar a Bíblia."); }
      }
    }, 500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [bibleReference, bibleVersion]);

  const groups = useMemo(() => ["Todas", ...Array.from(new Set(verses.map(v => v.group || "Geral")))], [verses]);
  const filtered = useMemo(() => verses.filter(v =>
    (group === "Todas" || (v.group || "Geral") === group) &&
    (v.reference + " " + v.text + " " + v.theme).toLowerCase().includes(query.toLowerCase())
  ), [verses, group, query]);

  function save() {
    if (!verse.reference.trim() || !verse.text.trim()) return;
    postMessage({ type: "save-verse", verse: { ...verse, id: verse.id || Date.now().toString(36), group: verse.group.trim() || "Geral" } });
    setVerse(blank()); setEditing(false); setTab("favorites");
  }
  function edit(v: Verse) { setVerse({ ...v }); setEditing(true); setTab("add"); }
  function present(v: Verse) {
    setBusy(true);
    postMessage({ type: "present", verse: v, output, contentLayer, backgroundLayer });
  }
  function move(delta: number, current: Verse) {
    const index = filtered.findIndex(v => v.id === current.id);
    const next = filtered[index + delta];
    if (next) present(next);
  }
  const layerOptions = layers.map(l => <option key={l.index} value={String(l.index)}>{l.name || "Camada " + l.index} (#{l.index})</option>);

  const isVisualAsset = (asset: any) => ["image", "video", "backgroundvideo", "motion", "motionbackground", "animatedbackground", "worshipwide"].includes(String(asset.type ?? "").toLowerCase()) || String(asset.guid ?? "").startsWith("worshipwide/");
  const visualAssets = libraryAssets.filter(isVisualAsset);
  const selectedBackgroundAsset = visualAssets.find((asset: any) => asset.guid === selectedBackgroundGuid) ?? null;

  return <main onClick={() => { if (contextVerse) setContextVerse(null); }}>
    <header><div className="brand">✦</div><div><strong>SHALOM</strong><span>BÍBLIA INTELIGENTE</span></div><i className="online" /></header>
    <section className="hero"><small>PAINEL DE MINISTRAÇÃO</small><h1>A Palavra,<br/><em>em acesso rápido.</em></h1><p>Monte suas listas de versículos e apresente com um clique.</p></section>
    <nav>
      <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>◷ Painel principal</button>
      <button className={tab === "scheduler" ? "active" : ""} onClick={() => { setTab("scheduler"); setEditingSchedule(false); setScheduleDraft(blankSchedule()); if (!libraryAssets.length) { setLoadingLibrary(true); postMessage({type:"list-library",assetType:"all"}); } }}>＋ Cadastro de eventos</button>
      <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>● Culto ao Vivo</button>
      <button className={tab === "lighting" ? "active" : ""} onClick={() => setTab("lighting")}>✦ Estúdio de iluminação</button>
      <button className={tab === "library" ? "active" : ""} onClick={() => { setTab("library"); setLoadingLibrary(true); postMessage({ type: "list-library", assetType: libraryType }); }}>▤ Biblioteca SPresenter</button>
      <button className={tab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")}>★ Favoritos</button>
      <button className={tab === "add" ? "active" : ""} onClick={() => { setTab("add"); if (!verse.id) setVerse(blank()); }}>＋ Adicionar</button>
      <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>⚙ Configurações</button>
    </nav>
    {notice && <div className="notice" onClick={() => setNotice("")}>{notice}<button>×</button></div>}

    {tab === "dashboard" && <section className="dashboard-shell">
      <div className="dashboard-heading"><div><small>SHALOM · CENTRAL DE AUTOMAÇÃO</small><h1>Painel de eventos</h1><p>Horários programados e ações previstas para a igreja.</p></div><div className="clock-card"><span>HORÁRIO LOCAL</span><strong>{new Date(clockNow).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong><small>{new Date(clockNow).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</small></div></div>
      <div className="dashboard-toolbar"><div><strong>{eventSchedules.filter(e => e.enabled).length}</strong><span> eventos ativos</span></div><button className="primary" onClick={() => { setScheduleDraft(blankSchedule()); setEditingSchedule(false); setTab("scheduler"); if (!libraryAssets.length) { setLoadingLibrary(true); postMessage({type:"list-library",assetType:"all"}); } }}>＋ Cadastrar evento</button></div>
      {eventSchedules.filter(e => e.enabled).sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).filter(e => new Date(e.date+"T"+e.time).getTime() >= clockNow - 60000).length === 0
        ? <div className="dashboard-empty"><div>◷</div><h2>Nenhum evento programado</h2><p>Quando você cadastrar um evento, o horário e todas as ações aparecerão aqui.</p><button className="primary" onClick={() => setTab("scheduler")}>Criar primeira programação</button></div>
        : <div className="event-list">{eventSchedules.filter(e => e.enabled).sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).filter(e => new Date(e.date+"T"+e.time).getTime() >= clockNow - 60000).map(event => {
          const when = new Date(event.date+"T"+event.time);
          const minutes = Math.max(0, Math.floor((when.getTime()-clockNow)/60000));
          const actions = [event.coverGuid && "Capa no SPresenter", event.grandmaCommand && "Cena de luzes · GrandMA2", event.song && "Louvor: "+event.song, event.vmixFunction && "Cena vMix: "+event.vmixFunction, event.startStream && "Iniciar transmissão"].filter(Boolean);
          return <article className="event-card" key={event.id}><div className="event-time"><strong>{event.time}</strong><span>{when.toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"short"})}</span></div><div className="event-details"><h2>{event.name}</h2><p>{actions.length ? actions.join(" · ") : "Nenhuma ação cadastrada"}</p><small>{minutes === 0 ? "Horário chegando" : minutes < 60 ? "Em "+minutes+" min" : "Em "+Math.floor(minutes/60)+"h "+(minutes%60)+"min"}</small></div><span className="event-status">PROGRAMADO</span></article>;
        })}</div>}
      <p className="scheduler-note">As programações são salvas no SPresenter. A execução automática dos comandos externos depende da conexão local configurada com o GrandMA2 e o vMix.</p>
    </section>}
    {tab === "scheduler" && <section className="card scheduler-form">
      <div className="section-title"><div><small>PROGRAMAÇÃO DO CULTO</small><h2>{editingSchedule ? "Editar evento" : "Cadastrar novo evento"}</h2></div><button className="ghost" onClick={() => { setEditingSchedule(false); setScheduleDraft(blankSchedule()); setTab("dashboard"); }}>Voltar ao painel</button></div>
      <label>Nome do evento<input value={scheduleDraft.name} onChange={e => setScheduleDraft(v => ({...v,name:e.target.value}))} placeholder="Ex.: Culto de domingo à noite" /></label>
      <div className="twocol"><label>Data<input type="date" value={scheduleDraft.date} onChange={e => setScheduleDraft(v => ({...v,date:e.target.value}))} /></label><label>Horário<input type="time" value={scheduleDraft.time} onChange={e => setScheduleDraft(v => ({...v,time:e.target.value}))} /></label></div>
      <div className="scheduler-section"><h3>① SPresenter · Capa</h3><label>Imagem, vídeo ou motion<select value={scheduleDraft.coverGuid} onChange={e => setScheduleDraft(v => ({...v,coverGuid:e.target.value}))}><option value="">Não alterar a capa</option>{visualAssets.map((asset:any)=><option key={asset.guid} value={asset.guid}>{asset.title || asset.name || asset.guid}</option>)}</select></label><button className="ghost" onClick={() => { setTab("library"); setLoadingLibrary(true); postMessage({type:"list-library",assetType:"all"}); }}>Atualizar biblioteca de mídias</button></div>
      <div className="scheduler-section"><h3>② GrandMA2 · Iluminação</h3><label>Comando da mesa<input value={scheduleDraft.grandmaCommand} onChange={e => setScheduleDraft(v => ({...v,grandmaCommand:e.target.value}))} placeholder="Ex.: Go Executor 1.1" /></label><p className="hint">Informe o comando do executor ou macro já preparado na mesa.</p></div>
      <div className="scheduler-section"><h3>③ Louvor</h3><label>Louvor / identificação<input value={scheduleDraft.song} onChange={e => setScheduleDraft(v => ({...v,song:e.target.value}))} placeholder="Nome do louvor ou identificação na biblioteca" /></label></div>
      <div className="scheduler-section"><h3>④ vMix · Câmera e transmissão</h3><label>Função / cena do vMix<input value={scheduleDraft.vmixFunction} onChange={e => setScheduleDraft(v => ({...v,vmixFunction:e.target.value}))} placeholder="Ex.: PreviewInput,1 ou Cut" /></label><label className="checkline"><input type="checkbox" checked={scheduleDraft.startStream} onChange={e => setScheduleDraft(v => ({...v,startStream:e.target.checked}))} /> Iniciar transmissão ao vivo neste horário</label></div>
      <div className="actions"><button className="primary" disabled={!scheduleDraft.name.trim() || !scheduleDraft.date || !scheduleDraft.time} onClick={() => { postMessage({type:"save-event-schedule",schedule:{...scheduleDraft,id:scheduleDraft.id || Date.now().toString(36),enabled:true}}); setTab("dashboard"); setEditingSchedule(false); setScheduleDraft(blankSchedule()); }}>{editingSchedule ? "Salvar alterações" : "Salvar programação"}</button><button className="ghost" onClick={() => { setScheduleDraft(blankSchedule()); setEditingSchedule(false); setTab("dashboard"); }}>Cancelar</button></div>
      <p className="scheduler-note">O cadastro e o painel ficam disponíveis nesta versão. Antes de liberar execução automática, precisamos validar o canal de rede do GrandMA2 e do vMix para evitar disparos falsos.</p>
      <div className="saved-schedules"><h3>Programações cadastradas</h3>{eventSchedules.length ? eventSchedules.map(event=><div className="saved-schedule" key={event.id}><div><strong>{event.name}</strong><small>{event.date.split("-").reverse().join("/")} às {event.time}</small></div><div className="actions"><button className="ghost" onClick={() => {setScheduleDraft(event);setEditingSchedule(true);}}>Editar</button><button className="danger" onClick={() => postMessage({type:"delete-event-schedule",id:event.id})}>Excluir</button></div></div>) : <p className="hint">Nenhuma programação salva ainda.</p>}</div>
    </section>}
    {tab === "lighting" && <section className="card">
      <div className="lighting-studio-heading"><small>ESTÚDIO DE ILUMINAÇÃO · SIMULAÇÃO REALISTA</small><h2>Crie cenas para o palco</h2></div>
      <p className="hint">Prévia local segura: sem aparelhos conectados e sem envio de comandos à GrandMA2. Configure grupos, cores, movimentos e salve suas cenas para testar.</p>
      <label>Nome da cena<input value={lightingName} onChange={e => setLightingName(e.target.value)} /></label>
      <label>Preset<select value={lightingPreset} onChange={e => { const id=e.target.value; setLightingPreset(id); const preset=lightingPresets.find(p=>p.id===id); if (!preset) return; setLightingGroups(groups=>groups.map(g=>({...g,color:preset.color,movement:preset.movement,colorBehavior:preset.colorBehavior,strobe:(preset as any).strobe ?? 0}))); }}><option value="custom">Personalizado</option>{lightingPresets.map(p=><option key={p.id} value={p.id}>{p.name} — {p.description}</option>)}</select></label>
      <label>Transição (segundos)<input type="number" min="0" max="60" value={lightingTransition} onChange={e=>setLightingTransition(Math.max(0,Math.min(60,Number(e.target.value)||0)))}/></label>
      <style>{`@keyframes shalomBeam {0%,100%{transform:translateX(-22px) rotate(-15deg);opacity:.45}50%{transform:translateX(22px) rotate(15deg);opacity:1}} @keyframes shalomPulse {0%,100%{opacity:.25}50%{opacity:1}} @keyframes shalomHue {to{filter:hue-rotate(360deg)}} @keyframes shalomBlink {0%,49%,100%{opacity:1}50%,99%{opacity:.12}}`}</style>
      <div className="importbox" style={{margin:"14px 0"}}>
        <strong>Prévia animada do palco</strong><p className="hint">Veja os grupos funcionando juntos. Simulação visual; não representa posicionamento DMX real.</p>
        <div style={{position:"relative",height:210,overflow:"hidden",borderRadius:10,background:"radial-gradient(ellipse at 50% 110%, #29334b, #101522 55%, #080b12)",border:"1px solid #394154"}}>
          <div style={{position:"absolute",left:"8%",right:"8%",bottom:22,height:3,background:"#667085"}}/>
          {lightingGroups.map((g,i)=>{const dur=(Math.max(5,105-g.speed)/10)+"s";const anim=[g.movement!=="fixed"?"shalomBeam "+dur+" ease-in-out infinite":"",g.colorBehavior==="pulse"?"shalomPulse "+dur+" ease-in-out infinite":g.colorBehavior==="rainbow"?"shalomHue "+dur+" linear infinite":g.colorBehavior==="wave"||g.colorBehavior==="chase"?"shalomPulse "+dur+" ease-in-out infinite":"",g.strobe>0?"shalomBlink "+Math.max(.15,1.5-g.strobe/100)+"s steps(2,end) infinite":""].filter(Boolean).join(",");return <div key={g.id} style={{position:"absolute",left:(8+i*25)+"%",top:18,width:"20%",height:155,display:"flex",justifyContent:"center"}}><div style={{width:32,height:22,borderRadius:5,background:"#252b38",border:"2px solid #687386",zIndex:2}}/><div style={{position:"absolute",top:22,width:5,height:112,background:g.color,opacity:g.intensity/100,boxShadow:"0 0 18px 5px "+g.color,transformOrigin:"top center",animation:anim||"none"}}/><div style={{position:"absolute",top:24,width:"100%",height:120,background:"linear-gradient(to bottom, transparent, "+g.color+"88, transparent)",opacity:g.intensity/100*.65,filter:"blur(8px)",animation:g.movement!=="fixed"?"shalomBeam "+dur+" ease-in-out infinite":"none"}}/><span style={{position:"absolute",bottom:0,fontSize:11,color:"#e6eaf2",whiteSpace:"nowrap"}}>{g.name}</span></div>;})}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
      {lightingGroups.map((g,i)=><div className="importbox" key={g.id}><strong>{g.name}</strong>
        <label>Group na GrandMA2<input type="number" min="1" max="9999" value={g.grandmaGroup ?? ""} placeholder="Ex.: 1" onChange={e=>setLightingGroups(gs=>gs.map((x,j)=>j===i?{...x,grandmaGroup:e.target.value}:x))}/></label><label>Preset Position MA2 (opcional)<input type="number" min="1" max="9999" value={g.grandmaPositionPreset ?? ""} placeholder="Ex.: 3" onChange={e=>setLightingGroups(gs=>gs.map((x,j)=>j===i?{...x,grandmaPositionPreset:e.target.value}:x))}/></label><label>Cor<input type="color" value={g.color} onChange={e=>setLightingGroups(gs=>gs.map((x,j)=>j===i?{...x,color:e.target.value}:x))}/></label>
        <label>Intensidade: {g.intensity}%<input type="range" min="0" max="100" value={g.intensity} onChange={e=>setLightingGroups(gs=>gs.map((x,j)=>j===i?{...x,intensity:Number(e.target.value)}:x))}/></label>
        <label>Movimento<select value={g.movement} onChange={e=>setLightingGroups(gs=>gs.map((x,j)=>j===i?{...x,movement:e.target.value}:x))}><option value="fixed">Fixo</option><option value="sweep">Varredura</option><option value="circle">Circular</option></select></label>
        <label>Comportamento de cor<select value={g.colorBehavior} onChange={e=>setLightingGroups(gs=>gs.map((x,j)=>j===i?{...x,colorBehavior:e.target.value}:x))}><option value="static">Estática</option><option value="wave">Onda</option><option value="rainbow">Ciclo</option><option value="pulse">Pulso</option><option value="chase">Perseguição</option></select></label>
        <label>Velocidade: {g.speed}<input type="range" min="0" max="100" value={g.speed} onChange={e=>setLightingGroups(gs=>gs.map((x,j)=>j===i?{...x,speed:Number(e.target.value)}:x))}/></label>
        <label>Estrobo: {g.strobe}%<input type="range" min="0" max="100" value={g.strobe} onChange={e=>setLightingGroups(gs=>gs.map((x,j)=>j===i?{...x,strobe:Number(e.target.value)}:x))}/></label>
        <div style={{height:12,borderRadius:6,background:g.color,opacity:g.intensity/100,boxShadow:"0 0 18px "+g.color}}/>
      </div>)}</div>
      <div className="actions"><button className="primary" onClick={()=>postMessage({type:"save-lighting-scene",scene:{id:"scene-"+Date.now(),name:lightingName.trim()||"Nova cena",preset:lightingPreset,transition:lightingTransition,groups:lightingGroups.map(g=>({...g,grandmaGroup:String(g.grandmaGroup ?? "").trim()}))}})}>Salvar cena</button><button className="ghost" onClick={()=>{setLightingGroups(defaultLightingGroups());setLightingPreset("custom");}}>Restaurar padrão</button></div>
      <h3>Cenas salvas</h3>{!lightingScenes.length?<p className="hint">Ainda não há cenas salvas.</p>:lightingScenes.map(scene=><div className="verse" key={scene.id}><div className="verse-head"><div><strong>{scene.name}</strong><small>{scene.groups.length} grupos · transição {scene.transition}s</small></div><button className="go" onClick={()=>{setLightingName(scene.name);setLightingPreset(scene.preset);setLightingTransition(scene.transition);setLightingGroups(scene.groups);}}>Carregar no simulador</button></div></div>)}
    </section>}
    {tab === "live" && <>
      <section className="card">
        <small>CONTROLE DURANTE O CULTO</small><h2>Bíblia</h2>
        <p className="hint">Digite a referência. O texto aparece automaticamente aqui embaixo, sem abrir outro painel e sem importar conteúdo.</p>
        <label>Versão da Bíblia<select value={bibleVersion} onChange={e => { setBibleVersion(e.target.value); setBibleResult(null); }}>
          {bibleVersions.map(version => <option key={version.id} value={version.id}>{version.name}</option>)}
        </select></label>
        <label>Livro, capítulo e versículo<input value={bibleReference} onChange={e => setBibleReference(e.target.value)} placeholder="Ex.: João 3:16 ou Salmos 23:1-2" /></label>
        {bibleStatus && <p className="hint">{bibleStatus}</p>}
        {bibleResult && <div className="preview-card" style={{marginTop:14}}>
          <div className="preview-heading"><div><small>PRÉVIA DO TEXTO BÍBLICO · {bibleVersions.find(v => v.id === bibleVersion)?.id.toUpperCase()}</small><strong>{bibleResult.reference}</strong></div><span>● NÃO ESTÁ AO VIVO</span></div>
          <div className="screen-verse-text" style={{padding:"18px 12px",fontSize:20,lineHeight:1.55}}>{bibleResult.text}</div>
          <button className="primary wide" disabled={busy} onClick={() => present({id:"",reference:bibleResult.reference,text:bibleResult.text,book:bibleResult.book || "",group:"Geral",background:"",theme:""})}>{busy ? "Enviando..." : "▶ Enviar para os telões"}</button>
        </div>}
        {!bibleStatus && !bibleResult && bibleReference.trim() && <p className="hint">Digite uma referência completa, como João 3:16 ou João 3:16-17.</p>}
        <p className="hint">A busca usa a tradução selecionada. As opções são versões oferecidas pela fonte bíblica externa; o SDK do SPresenter não permite consultar automaticamente as traduções instaladas nele. Pesquisar e visualizar nunca altera o conteúdo que está ao vivo.</p>
      </section>
      <section className="card">
        <small>BIBLIOTECA DO SPRESENTER</small><h2>Louvores cadastrados</h2>
        <label>Buscar música<input value={songQuery} onChange={e => setSongQuery(e.target.value)} placeholder="Digite o nome do louvor..." onKeyDown={e => { if (e.key === "Enter" && songQuery.trim()) { setSearchingSongs(true); setSongSearchStatus("Consultando a biblioteca do SPresenter…"); setSongSearchSource(""); postMessage({ type: "search-songs", query: songQuery.trim() }); } }} /></label>
        <button className="primary" disabled={!songQuery.trim() || searchingSongs} onClick={() => { setSearchingSongs(true); setSongSearchStatus("Consultando a biblioteca do SPresenter…"); setSongSearchSource(""); postMessage({ type: "search-songs", query: songQuery.trim() }); }}>{searchingSongs ? "Buscando..." : "Buscar louvores"}</button>
        {songSearchStatus && <p className="hint">{searchingSongs ? "⏳ " : ""}{songSearchStatus}</p>}
        {songs.map(song => song.online ? <div className="verse" key={song.guid}>
          <div className="verse-head"><div><strong>{song.title}</strong><small>{song.artist}{song.album ? " • " + song.album : ""}</small></div><span className="hint">Internet</span></div>
          <p className="hint">Encontrado fora da biblioteca local. Para usar no telão, importe o louvor e sua letra/licença para o SPresenter.</p>
          {song.url && <a href={song.url} target="_blank" rel="noreferrer">Abrir na Apple Music / iTunes</a>}
        </div> : <div className="verse" key={song.guid}><div className="verse-head"><div><strong>{song.title || song.name}</strong><small>{song.artist || song.author || "Louvor cadastrado"}</small></div><button className="go" onClick={() => postMessage({ type: "get-song-sections", guid: song.guid })}>Ver partes</button></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginTop:10}}>
          {(songSections[song.guid] || []).map((section: any, index: number) => {
            const wasSent = lastSentSongSection?.guid === song.guid && lastSentSongSection.index === index;
            return <div key={index} style={{padding:12,border:wasSent ? "2px solid #22a06b" : "1px solid var(--border, #444)",borderRadius:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <strong>{section.type || "Parte"} {index + 1}</strong>
                {wasSent && <span className="tag">✓ ENVIADO</span>}
              </div>
              {sectionBody(section) && <p style={{whiteSpace:"pre-wrap",margin:"8px 0"}}>{sectionBody(section)}</p>}
              <button className={wasSent ? "primary" : "ghost"} onClick={() => postMessage({ type: "present-song", guid: song.guid, index, output, contentLayer })}>{wasSent ? "✓ Parte enviada" : "▶ Enviar esta parte aos telões"}</button>
            </div>;
          })}
          </div>
          <button className="primary" style={{marginTop:8}} onClick={() => postMessage({ type: "present-song", guid: song.guid, index: 0, output, contentLayer })}>▶ Apresentar louvor</button>
        </div>)}
        {!songs.length && !searchingSongs && !songSearchStatus && <p className="hint">Pesquise para localizar primeiro na biblioteca do SPresenter e, se não houver resultado, na internet.</p>}
        <p className="hint">A busca online mostra título, artista e álbum, com link para a loja. Letras protegidas por direitos autorais não são copiadas automaticamente; louvores cadastrados localmente continuam com prévia e envio direto.</p>
      </section>
      <section className="card">
        <small>FUNDOS E MOTIONS DO SPRESENTER</small><h2>Imagens, vídeos e Worshipwide</h2>
        <p className="hint">Escolha imagens, vídeos e motions disponíveis na biblioteca local ou já adicionados ao setlist ativo. A prévia não altera o telão; somente o botão de envio muda a camada Fundo.</p>
        <button className="ghost" disabled={loadingLibrary} onClick={() => { setLoadingLibrary(true); postMessage({ type: "list-library", assetType: "all" }); }}>{loadingLibrary ? "Carregando biblioteca..." : "Atualizar mídias locais"}</button>
        <label>Mídia da biblioteca<select value={selectedBackgroundGuid} onChange={e => setSelectedBackgroundGuid(e.target.value)}>
          <option value="">Selecione imagem, vídeo ou fundo animado...</option>
          {visualAssets.map((asset: any) => <option key={asset.guid} value={asset.guid}>{asset.title || asset.name || "Mídia sem título"} · {asset.type === "worshipwide" ? "Worshipwide / Motion" : asset.type === "backgroundVideo" || asset.type === "video" ? "Vídeo / Fundo animado" : asset.type}</option>)}
        </select></label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:12}}>
          <div className="importbox">
            <strong>Prévia selecionada</strong>
            {selectedBackgroundAsset?.thumbnail
              ? <img src={selectedBackgroundAsset.thumbnail} alt={selectedBackgroundAsset.title || "Prévia da mídia"} style={{display:"block",width:"100%",aspectRatio:"16/9",objectFit:"cover",marginTop:8,borderRadius:8}} />
              : <div style={{marginTop:8,aspectRatio:"16/9",display:"grid",placeItems:"center",background:"rgba(120,120,120,.12)",borderRadius:8}}>Prévia não disponível</div>}
            <p className="hint">{selectedBackgroundAsset ? (selectedBackgroundAsset.title || selectedBackgroundAsset.name) + " · " + selectedBackgroundAsset.type : "Selecione uma mídia local."}</p>
            <button className="primary wide" disabled={!selectedBackgroundAsset} onClick={() => postMessage({ type:"present-library-background", guid:selectedBackgroundAsset.guid, thumbnail:selectedBackgroundAsset.thumbnail, output, backgroundLayer })}>▶ Enviar fundo para os telões</button>
          </div>
          <div className="importbox">
            <strong>Último fundo enviado</strong>
            {lastSentBackgroundAsset ? <>
              <span className="tag" style={{display:"inline-block",marginTop:8}}>● NO TELÃO</span>
              <p>{lastSentBackgroundAsset.title}</p>
            </> : <p className="hint">Nenhuma mídia enviada por este painel nesta sessão.</p>}
          </div>
        </div>
        <p className="hint">A lista inclui imagens e vídeos da biblioteca e motions que já estejam no setlist ativo. O catálogo remoto completo do Worshipwide ainda não é enumerável pela API pública do plugin. Imagens usam o renderer do SPresenter; vídeos e motions são enviados como fundo. A camada Conteúdo do louvor é preservada.</p>
      </section>
      <section className="card">
        <small>COMUNICAÇÃO COM A IGREJA</small><h2>Mensagem informativa</h2>
        <label>Texto para o telão<textarea rows={4} value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="Ex.: Atenção: após o culto teremos reunião..." /></label>
        <button className="primary" disabled={!messageText.trim()} onClick={() => postMessage({ type: "present-message", text: messageText, output, contentLayer })}>Apresentar mensagem</button>
        <button className="ghost" style={{marginLeft:8}} onClick={() => postMessage({ type: "clear-content", output, contentLayer })}>Retirar mensagem</button>
      </section>
      <section className="card">
        <small>APRESENTAÇÕES MULTIMÍDIA</small><h2>PowerPoint com vídeos</h2>
        <p className="hint">O SDK público atual não documenta importação nem controle de arquivos .ppt/.pptx pelo plugin. Para preservar vídeos, transições e avanço de slides, abra a apresentação no recurso nativo de apresentações do SPresenter após importá-la por lá.</p>
        <button className="ghost" onClick={() => postMessage({ type: "open-media" })}>Abrir painel de mídia do SPresenter</button>
        <p className="hint">Não vou simular um carregamento de PowerPoint que não consiga reproduzir os vídeos corretamente.</p>
      </section>
      <section className="card livebar">
        <small>SAÍDA E CAMADAS DO TELÃO</small>
        <label>Saída<select value={output} onChange={e => setOutput(e.target.value)}>{outputs.map(o => <option key={o.index} value={String(o.index)}>{o.name || "Saída " + o.index} (#{o.index})</option>)}</select></label>
        <label>Camada Conteúdo<select value={contentLayer} onChange={e => setContentLayer(e.target.value)}>{layerOptions}</select></label>
        <label>Camada Fundo<select value={backgroundLayer} onChange={e => setBackgroundLayer(e.target.value)}>{layerOptions}</select></label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:12}}>
          <button className="danger wide" onClick={() => postMessage({ type:"clear-content", output, contentLayer })}>Limpar letra / conteúdo · F10</button>
          <button className="ghost wide" onClick={() => postMessage({ type:"clear-background", output, backgroundLayer })}>Limpar fundo · F11</button>
        </div>
        <p className="hint">F10 limpa somente a camada Conteúdo. F11 limpa somente a camada Fundo. Os atalhos funcionam enquanto o painel do plugin estiver aberto.</p>
      </section>
    </>}
    {tab === "library" && <section className="card">
      <small>ITENS JÁ CADASTRADOS NO SPRESENTER</small><h2>Biblioteca do SPresenter</h2>
      <p className="hint">Lista os arquivos e louvores existentes na biblioteca do SPresenter. A Bíblia nativa é uma biblioteca separada e não é retornada pela API pública de assets.</p>
      <label>Tipo de conteúdo<select value={libraryType} onChange={e => { setLibraryType(e.target.value); setLoadingLibrary(true); postMessage({ type: "list-library", assetType: e.target.value }); }}><option value="all">Todos os itens</option><option value="music">Louvores</option><option value="image">Imagens</option><option value="video">Vídeos</option><option value="slidePresentation">Apresentações</option><option value="audio">Áudios</option></select></label>
      <button className="ghost" disabled={loadingLibrary} onClick={() => { setLoadingLibrary(true); postMessage({ type: "list-library", assetType: libraryType }); }}>{loadingLibrary ? "Atualizando..." : "Atualizar lista"}</button>
      {libraryAssets.length === 0 ? <p className="hint">{loadingLibrary ? "Carregando biblioteca..." : "Nenhum item encontrado nesta categoria."}</p> : libraryAssets.map((asset: any) => <div className="verse" key={asset.guid}><div className="verse-head"><div><strong>{asset.title || asset.name || "Item sem título"}</strong><small>{asset.type || "Arquivo"}{asset.artist ? " • " + asset.artist : ""}</small></div><button className="go" onClick={() => { if (asset.type === "music") postMessage({ type: "present-song", guid: asset.guid, index: 0, output, contentLayer }); else postMessage({ type: "open-media" }); }}> {asset.type === "music" ? "▶ Enviar" : "Abrir mídia"} </button></div></div>)}
      <p className="hint">Louvores podem ser enviados diretamente para a camada Conteúdo. Para imagens, vídeos e apresentações, a lista permite localizar o item e abrir o painel nativo de mídia; o SDK não documenta uma operação genérica para projetar esses tipos.</p>
    </section>}
    {tab === "favorites" && <>
      <section className="card">
        <small>FUNDO DA MINISTRAÇÃO</small>
        <h2>Enviar somente o fundo</h2>
        <p className="hint">Escolha a categoria para projetar sua imagem padrão sem enviar ou alterar o versículo na camada Conteúdo.</p>
        <label>Categoria<select value={backgroundCategory} onChange={e => setBackgroundCategory(e.target.value)}>
          <option value="Ceia">Ceia</option><option value="Palavra">Palavra</option><option value="Dízimo">Dízimo</option>
        </select></label>
        <button className="wide primary" onClick={() => postMessage({ type: "present-category-background", category: backgroundCategory, output, backgroundLayer })}>Enviar somente fundo</button>
      </section>
      <section className="card livebar">
        <div><small>DESTINO DA PROJEÇÃO</small><strong>Saída {output}</strong></div>
        <label>Saída<select value={output} onChange={e => setOutput(e.target.value)}>{outputs.map(o => <option key={o.index} value={String(o.index)}>{o.name || "Saída " + o.index} (#{o.index})</option>)}</select></label>
        <div className="smallrow"><span>Conteúdo: {layers.find(l => String(l.index) === contentLayer)?.name || contentLayer}</span><span>Fundo: {layers.find(l => String(l.index) === backgroundLayer)?.name || backgroundLayer}</span></div>
      </section>
      <section className="library">
        <div className="section-title"><div><small>ATALHOS SALVOS</small><h2>Favoritos da ministração</h2></div><span className="count">{verses.length}</span></div>
        <input className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar referência, texto ou tema..." />
        <div className="groupchips">{groups.map(g => <button key={g} className={group === g ? "chosen" : ""} onClick={() => setGroup(g)}>{g}</button>)}</div>
        {filtered.length === 0 ? <div className="empty">Nenhum versículo salvo. Use “Adicionar” para criar sua primeira lista.</div> : <div className="verse-list">{filtered.map(v =>
          <article className="verse" key={v.id} onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextVerse(v.id); }}>\n            {contextVerse === v.id && <div className="context-menu" onClick={e => e.stopPropagation()}><button onClick={() => { edit(v); setContextVerse(null); }}>＋ Adicionar / editar</button><button onClick={() => { present(v); setContextVerse(null); }}>▶ Apresentar</button><button onClick={() => setContextVerse(null)}>Fechar</button></div>}
            <div className="verse-head"><div><strong>{v.reference}</strong><small>{v.group || "Geral"}</small></div><div className="verse-actions"><button className="go" onClick={() => present(v)}>▶ APRESENTAR</button><button onClick={() => edit(v)}>Editar</button><button className="danger" onClick={() => postMessage({ type: "delete-verse", id: v.id })}>Excluir</button></div></div>
            <p>{v.text}</p>{v.theme && <span className="tag">{v.theme}</span>}
            <div className="sequence"><button onClick={() => move(-1, v)}>← Anterior</button><button onClick={() => move(1, v)}>Próximo →</button></div>
          </article>
        )}</div>}
      </section>
      <button className="wide primary" onClick={() => postMessage({ type: "restore-previous-background", output, contentLayer, backgroundLayer })}>Encerrar versículo e voltar ao fundo anterior</button>
      <button className="wide danger" onClick={() => postMessage({ type: "clear-content", output, contentLayer })}>Limpar letra / conteúdo · F10</button>
      <button className="wide ghost" onClick={() => postMessage({ type: "clear-background", output, backgroundLayer })}>Limpar fundo · F11</button>
      <button className="wide ghost" onClick={() => postMessage({ type: "clear", output, contentLayer, backgroundLayer })}>Limpar os dois</button>
    </>}
    {tab === "add" && <section className="card">
      <div className="section-title"><div><small>BIBLIOTECA PESSOAL</small><h2>{editing ? "Editar favorito" : "Adicionar versículo"}</h2></div></div>
      <div className="importbox"><strong>Sincronização automática com a Bíblia</strong><p>Deixe a Bíblia do SPresenter aberta e selecione o versículo para colocá-lo na camada Conteúdo. O Shalom acompanha essa camada e atualiza a prévia sozinho — não precisa importar nem digitar.</p><div className="actions"><button className="ghost" onClick={() => postMessage({ type: "open-bible" })}>Abrir Bíblia do SPresenter</button></div></div>
      {verse.text.trim() && <div className="preview-card">
        <div className="preview-heading"><div><small>PRÉVIA DO TELÃO</small><strong>Confira antes de enviar</strong></div><span>● NÃO ESTÁ AO VIVO</span></div>
        <div className="verse-screen-preview">
          <div className="screen-verse-text">{verse.text}</div>
          <div className="screen-verse-reference">{verse.reference || "Referência não informada"}</div>
        </div>
        <p className="hint">Esta é uma prévia dentro do plugin. Ela não altera a transmissão nem substitui o fundo que já está programado no SPresenter.</p>
        <button className="primary wide" disabled={!verse.reference.trim() || !verse.text.trim() || busy} onClick={() => present(verse)}>{busy ? "Enviando..." : "▶ Enviar para os telões"}</button>
      </div>}
      <label>Livro bíblico<input value={verse.book || ""} onChange={e => setVerse({ ...verse, book: e.target.value })} placeholder="Preenchido automaticamente ao importar" /></label>\n      <label>Referência bíblica<input value={verse.reference} onChange={e => setVerse({ ...verse, reference: e.target.value })} placeholder="Ex.: João 3:16" /></label>
      <label>Texto do versículo<textarea rows={5} value={verse.text} onChange={e => setVerse({ ...verse, text: e.target.value })} placeholder="Cole ou digite o texto bíblico..." /></label>
      <div className="twocol"><label>Categoria<select value={verse.group || "Geral"} onChange={e => setVerse({ ...verse, group: e.target.value })}><option value="Geral">Geral</option><option value="Ceia">Ceia</option><option value="Palavra">Palavra</option><option value="Dízimo">Dízimo</option></select></label><label>Tema<input value={verse.theme} onChange={e => setVerse({ ...verse, theme: e.target.value })} placeholder="Ex.: Fé, esperança" /></label></div>
      <label>Imagem de fundo — endereço da internet (opcional)<input value={verse.background.startsWith("data:image/") ? "" : verse.background} onChange={e => setVerse({ ...verse, background: e.target.value })} placeholder="https://... (imagem panorâmica)" /></label>
      <label>Ou escolha uma imagem do computador<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" onChange={e => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) { setNotice("Formato não suportado. Escolha JPG, PNG, WEBP ou GIF."); e.target.value = ""; return; }
        if (file.size > 6 * 1024 * 1024) { setNotice("A imagem local deve ter até 6 MB."); e.target.value = ""; return; }
        const reader = new FileReader();
        reader.onload = () => setVerse(v => ({ ...v, background: String(reader.result ?? "") }));
        reader.onerror = () => setNotice("Não foi possível ler esse arquivo.");
        reader.readAsDataURL(file);
      }} /></label>
      {verse.background.startsWith("data:image/") && <div className="importbox"><strong>Imagem local selecionada</strong><img src={verse.background} alt="Pré-visualização do fundo" style={{display:"block",width:"100%",maxHeight:190,objectFit:"contain",marginTop:10,borderRadius:8}} /><button className="ghost" style={{marginTop:10}} onClick={() => setVerse(v => ({ ...v, background: "" }))}>Remover imagem local</button></div>}
      <p className="hint">Você pode usar uma URL pública ou selecionar um arquivo do computador. Imagens locais de até 6 MB ficam salvas junto ao favorito. Formatos: JPG, PNG, WEBP e GIF.</p>
      <div className="actions"><button className="primary" disabled={!verse.reference.trim() || !verse.text.trim()} onClick={save}>{editing ? "Salvar alterações" : "Salvar nos favoritos"}</button><button className="ghost" onClick={() => { setVerse(blank()); setEditing(false); setTab("favorites"); }}>Cancelar</button></div>
    </section>}
    {tab === "settings" && <>
    <section className="card">
      <small>PADRÃO VISUAL DAS MINISTRAÇÕES</small><h2>Imagens padrão por categoria</h2>
      <p className="hint">Escolha uma imagem para cada momento. Ela será usada nos versículos da categoria correspondente quando o favorito não tiver imagem própria.</p>
      {(["Ceia", "Palavra", "Dízimo"] as const).map(category => <label key={category}>{category} — imagem padrão
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => {
          const file = e.target.files?.[0]; if (!file) return;
          if (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)) { setNotice("Escolha JPG, PNG, WEBP ou GIF."); e.target.value = ""; return; }
          if (file.size > 6 * 1024 * 1024) { setNotice("A imagem deve ter até 6 MB."); e.target.value = ""; return; }
          const reader = new FileReader();
          reader.onload = () => setGroupBackgrounds(v => ({ ...v, [category]: String(reader.result ?? "") }));
          reader.onerror = () => setNotice("Não foi possível ler essa imagem.");
          reader.readAsDataURL(file);
        }} />
        {groupBackgrounds[category] && <div className="importbox"><strong>Imagem padrão selecionada</strong><img src={groupBackgrounds[category]} alt={"Fundo padrão " + category} style={{display:"block",width:"100%",maxHeight:150,objectFit:"contain",marginTop:8,borderRadius:8}}/><button className="ghost" style={{marginTop:8}} onClick={() => setGroupBackgrounds(v => ({ ...v, [category]: "" }))}>Remover imagem</button></div>}
      </label>)}
      <button className="primary" onClick={() => postMessage({ type: "save-group-backgrounds", groupBackgrounds })}>Salvar imagens padrão</button>
    </section>
    <section className="card">
      <small>REDE E EQUIPAMENTOS</small><h2>Endereços dos equipamentos</h2>
      <p className="hint">Cadastre os IPs atuais. Como a rede usa DHCP, se algum endereço mudar, atualize aqui e salve novamente. O endereço 10.0.0.2 da interface Art-Net não deve ser colocado como IP da mesa, a menos que seja realmente o IP de controle da GrandMA2.</p>
      <label>IP da mesa GrandMA2 / computador grandMA2 onPC
        <input value={connectionSettings.grandmaIp} onChange={e => setConnectionSettings(v => ({...v, grandmaIp:e.target.value.trim()}))} placeholder="Ex.: 192.168.1.50" inputMode="decimal" />
      </label>
      <label>IP do computador que executa o vMix
        <input value={connectionSettings.vmixIp} onChange={e => setConnectionSettings(v => ({...v, vmixIp:e.target.value.trim()}))} placeholder="Ex.: 192.168.1.60" inputMode="decimal" />
      </label>
      <div className="actions"><button className="primary" onClick={() => postMessage({type:"save-connection-settings", connectionSettings})}>Salvar endereços</button><button className="ghost" onClick={() => setConnectionSettings(blankConnections())}>Limpar campos</button></div>
      <details className="importbox" style={{marginTop:14}}>
        <summary style={{cursor:"pointer",fontWeight:700}}>Configurar acesso Telnet da GrandMA2</summary>
        <p className="hint">A ponte local precisa estar iniciada no computador que executa o SPresenter. A senha é opcional e, quando informada, é enviada somente à ponte e fica em memória enquanto o processo estiver rodando.</p>
        <label>Porta Telnet<input value={grandmaTelnetPort} onChange={e => setGrandmaTelnetPort(e.target.value)} inputMode="numeric" placeholder="30000" /></label>
        <label>Usuário Telnet
          <input autoComplete="username" value={grandmaTelnet.username} onChange={e => setGrandmaTelnet(v => ({...v, username:e.target.value}))} placeholder="Usuário dedicado da GrandMA2" />
        </label>
        <label>Senha Telnet
          <input type="password" autoComplete="current-password" value={grandmaTelnet.password} onChange={e => setGrandmaTelnet(v => ({...v, password:e.target.value}))} placeholder="Senha (opcional, se o usuário não tiver senha)" />
        </label>
        <div className="actions"><button className="primary" onClick={configureGrandmaBridge}>Configurar ponte local</button><button className="ghost" onClick={testGrandmaBridge}>Testar conexão</button></div>
        <p className="hint">Status: {grandmaBridgeStatus}</p>
        <label>Comando GrandMA2 (teste)
          <input value={grandmaCommand} onChange={e => setGrandmaCommand(e.target.value)} placeholder="List Group Thru 10" />
        </label>
        <button className="ghost" onClick={sendGrandmaCommand} disabled={!grandmaCommand.trim()}>Enviar comando</button>
        {grandmaResponse && <pre className="importbox" style={{whiteSpace:"pre-wrap",maxHeight:220,overflow:"auto"}}>{grandmaResponse}</pre>}
        <p className="hint">Use inicialmente apenas comandos de consulta, como List Group Thru 10. Não execute comandos de iluminação ao vivo antes de validar a conexão.</p>
        
        <div className="scheduler-section"><h3>Biblioteca da GrandMA2</h3><p className="hint">Consulta o show carregado na mesa. Os resultados são exibidos abaixo; a quantidade depende dos objetos existentes e das permissões do usuário.</p><button className="ghost" disabled={grandmaCatalogLoading} onClick={readGrandmaCatalog}>{grandmaCatalogLoading ? "Lendo show..." : "↻ Ler grupos, 12 tipos de preset, cenas e macros"}</button>{grandmaCatalog.map(item=><div className="importbox" key={item.name}><strong>{item.name}</strong><pre style={{whiteSpace:"pre-wrap",maxHeight:180,overflow:"auto"}}>{item.response}</pre></div>)}</div>
        <div className="scheduler-section"><h3>Importar biblioteca / XML da GrandMA2</h3>
          <p className="hint">Importe um XML exportado da GrandMA2 para identificar Groups, Presets, Sequences, Cues, Macros e Effects. A importação faz uma leitura local e mostra uma prévia; não altera o show nem envia comandos à mesa.</p>
          <label>Arquivo XML da GrandMA2<input type="file" accept=".xml,text/xml,application/xml" onChange={e => { void importGrandmaXml(e.target.files?.[0]); e.currentTarget.value = ""; }} /></label>
          {grandmaImportStatus && <p className="hint">{grandmaImportStatus}</p>}
          {grandmaImportedXmlName && <><strong>{grandmaImportedXmlName}</strong><p className="hint">{grandmaImportedObjects.length} itens identificados (limite de prévia: 500).</p>
            {grandmaImportedObjects.length > 0 && <div className="importbox" style={{maxHeight:260,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={{textAlign:"left"}}>Tipo</th><th style={{textAlign:"left"}}>Nome</th><th style={{textAlign:"left"}}>Nº / ID</th></tr></thead><tbody>{grandmaImportedObjects.slice(0,120).map((item,index)=><tr key={index}><td>{item.kind}</td><td>{item.name}</td><td>{item.number}</td></tr>)}</tbody></table>{grandmaImportedObjects.length>120 && <p className="hint">Mostrando os primeiros 120 itens.</p>}</div>}
          </>}
          <p className="hint">Para obter o XML, use a função de exportação XML da GrandMA2 e escolha os objetos desejados. Arquivos .show completos, binários ou pacotes ZIP ainda precisam de um conversor específico; não serão tratados como XML.</p>
        </div>
        <div className="scheduler-section"><h3>Enviar uma cena salva do Estúdio de Iluminação</h3><p className="hint">Selecione uma cena já montada no plugin. Os grupos precisam ter o número correspondente de Group na GrandMA2 configurado no Estúdio. A transferência aplica intensidade e cor no Programmer e grava uma Cue 1 em uma Sequence nova.</p><label>Cena salva<select value={grandmaSelectedLightingSceneId} onChange={e=>{setGrandmaSelectedLightingSceneId(e.target.value);const selected=lightingScenes.find(scene=>scene.id===e.target.value);if(selected){setGrandmaSceneName(selected.name);}}}><option value="">Selecione uma cena...</option>{lightingScenes.map(scene=><option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label><label>Número da Sequence para gravar<input value={grandmaSequenceNumber} onChange={e=>setGrandmaSequenceNumber(e.target.value)} inputMode="numeric"/></label><button className="primary" disabled={!lightingScenes.length} onClick={sendSavedLightingSceneToGrandma}>Enviar cena selecionada para GrandMA2</button><p className="hint">A prévia do plugin é apenas uma simulação. Movimento, onda, ciclo, pulso, perseguição e estrobo ainda exigem programação de efeitos/presets na GrandMA2; não serão simulados como se já estivessem programados.</p></div><div className="scheduler-section"><h3>Cadastrar cena e preset na GrandMA2</h3><p className="hint">Prepare os aparelhos e valores no Programmer. O plugin consulta os endereços antes de gravar. Não executa Go nem coloca a cena no ar.</p><label>Número da Sequence<input value={grandmaSequenceNumber} onChange={e=>setGrandmaSequenceNumber(e.target.value)} inputMode="numeric" /></label><label>Nome da cena / preset<input value={grandmaSceneName} onChange={e=>setGrandmaSceneName(e.target.value)} /></label><label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={grandmaSavePreset} onChange={e=>setGrandmaSavePreset(e.target.checked)} /> Cadastrar também um preset</label>{grandmaSavePreset && <div className="twocol"><label>Tipo de preset<select value={grandmaPresetType} onChange={e=>setGrandmaPresetType(e.target.value)}><option value="1">1 · Dimmer</option><option value="2">2 · Position</option><option value="3">3 · Gobo</option><option value="4">4 · Color</option><option value="5">5 · Beam</option><option value="6">6 · Focus</option><option value="7">7 · Shapers</option><option value="8">8 · Video</option><option value="9">9 · Control</option><option value="10">10 · Sound</option><option value="11">11 · Media</option><option value="12">12 · 3D</option></select></label><label>Número do preset<input value={grandmaPresetNumber} onChange={e=>setGrandmaPresetNumber(e.target.value)} inputMode="numeric" /></label></div>}<button className="primary" onClick={createGrandmaScene}>Verificar e cadastrar na GrandMA2</button></div>
      </details>
      <p className="hint">Esses endereços ficam salvos no armazenamento do plugin. Ainda será necessário configurar/validar a comunicação entre as redes; cadastrar o IP não cria rota de rede automaticamente.</p>
    </section>
    <section className="card">
      <small>INTEGRAÇÃO SPRESENTER</small><h2>Camadas e saída</h2>
      <label>Saída<select value={output} onChange={e => setOutput(e.target.value)}>{outputs.map(o => <option key={o.index} value={String(o.index)}>{o.name || "Saída " + o.index} (#{o.index})</option>)}</select></label>
      <label>Camada Conteúdo<select value={contentLayer} onChange={e => setContentLayer(e.target.value)}>{layerOptions}</select></label>
      <label>Camada Fundo<select value={backgroundLayer} onChange={e => setBackgroundLayer(e.target.value)}>{layerOptions}</select></label>
      <label>Importar texto da camada<select value={captureLayer} onChange={e => setCaptureLayer(e.target.value)}>{layerOptions}</select></label>
      <p className="hint">A seleção da Bíblia nativa é importada após o versículo ser colocado ao vivo. A API pública documentada não expõe leitura direta da lista interna de traduções e versículos.</p>
      <button className="primary" onClick={() => postMessage({ type: "open-bible" })}>Abrir painel Bíblia</button>
    </section></>}
    <footer>SHALOM COMUNIDADE CRISTÃ <span>•</span> v0.4.0</footer>
  </main>;
}
