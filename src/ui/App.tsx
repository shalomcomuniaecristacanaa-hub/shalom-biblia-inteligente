import { useEffect, useMemo, useState } from "react";
import { onMessage, postMessage } from "@spresenter/plugin-sdk/ui";

type Verse = { id: string; reference: string; text: string; group: string; background: string; theme: string; book?: string };
type Output = { index: number; name?: string };
type Layer = { index: number; name?: string };
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
  const [tab, setTab] = useState<"live" | "library" | "favorites" | "add" | "settings">("live");
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

  useEffect(() => {
    const off = onMessage(raw => {
      const m = raw as any;
      if (m.type === "state") {
        setVerses(m.verses ?? []); setOutputs(m.outputs ?? []); setLayers(m.layers ?? []); setGroupBackgrounds(m.groupBackgrounds ?? { Ceia: "", Palavra: "", "Dízimo": "" });
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
      <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>● Culto ao Vivo</button>
      <button className={tab === "library" ? "active" : ""} onClick={() => { setTab("library"); setLoadingLibrary(true); postMessage({ type: "list-library", assetType: libraryType }); }}>▤ Biblioteca SPresenter</button>
      <button className={tab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")}>★ Favoritos</button>
      <button className={tab === "add" ? "active" : ""} onClick={() => { setTab("add"); if (!verse.id) setVerse(blank()); }}>＋ Adicionar</button>
      <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>⚙ Configurações</button>
    </nav>
    {notice && <div className="notice" onClick={() => setNotice("")}>{notice}<button>×</button></div>}
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
        <small>SAÍDA E CAMADA DE CONTEÚDO</small>
        <label>Saída<select value={output} onChange={e => setOutput(e.target.value)}>{outputs.map(o => <option key={o.index} value={String(o.index)}>{o.name || "Saída " + o.index} (#{o.index})</option>)}</select></label>
        <label>Camada Conteúdo<select value={contentLayer} onChange={e => setContentLayer(e.target.value)}>{layerOptions}</select></label>
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
      <button className="wide ghost" onClick={() => postMessage({ type: "clear", output, contentLayer, backgroundLayer })}>Limpar Conteúdo e Fundo</button>
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
