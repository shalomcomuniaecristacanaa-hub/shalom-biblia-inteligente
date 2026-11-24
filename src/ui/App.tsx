import { useEffect, useMemo, useState } from "react";
import { onMessage, postMessage } from "@spresenter/plugin-sdk/ui";

type Verse = { id: string; reference: string; text: string; group: string; background: string; theme: string; book?: string };
type Output = { index: number; name?: string };
type Layer = { index: number; name?: string };
const blank = (): Verse => ({ id: "", reference: "", text: "", group: "Geral", background: "", theme: "", book: "" });

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
  const [bibleResult, setBibleResult] = useState<any | null>(null);
  const [bibleStatus, setBibleStatus] = useState("");
  const [songQuery, setSongQuery] = useState("");
  const [songs, setSongs] = useState<any[]>([]);
  const [songSections, setSongSections] = useState<Record<string, any[]>>({});
  const [messageText, setMessageText] = useState("");
  const [searchingSongs, setSearchingSongs] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<any[]>([]);
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
      if (m.type === "bible-found") { setBibleResult(m.result ?? null); setBibleStatus(""); }
      if (m.type === "bible-error") { setBibleResult(null); setBibleStatus(m.message || "Não foi possível localizar essa referência."); }
      if (m.type === "captured") {
        setVerse(v => ({ ...v, reference: m.reference || "", book: m.book || "", text: m.text || "" }));
        setTab("add"); setNotice("Versículo da Bíblia do SPresenter atualizado automaticamente na prévia.");
      }
      if (m.type === "presented") setNotice(m.background === "error" ? "Versículo apresentado. " + m.message : "Apresentado: " + (m.reference || m.message || "Conteúdo enviado"));
      if (m.type === "songs-found") { setSongs(m.songs ?? []); setSearchingSongs(false); }
      if (m.type === "library-found") { setLibraryAssets(m.assets ?? []); setLoadingLibrary(false); }
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
    setBibleStatus("Buscando texto bíblico…");
    const timer = window.setTimeout(() => {
      postMessage({ type: "lookup-bible", reference, version: "nvi" });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [bibleReference]);

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
        <label>Livro, capítulo e versículo<input value={bibleReference} onChange={e => setBibleReference(e.target.value)} placeholder="Ex.: João 3:16 ou Salmos 23:1-2" /></label>
        {bibleStatus && <p className="hint">{bibleStatus}</p>}
        {bibleResult && <div className="preview-card" style={{marginTop:14}}>
          <div className="preview-heading"><div><small>PRÉVIA DO TEXTO BÍBLICO · NVI</small><strong>{bibleResult.reference}</strong></div><span>● NÃO ESTÁ AO VIVO</span></div>
          <div className="screen-verse-text" style={{padding:"18px 12px",fontSize:20,lineHeight:1.55}}>{bibleResult.text}</div>
          <button className="primary wide" disabled={busy} onClick={() => present({id:"",reference:bibleResult.reference,text:bibleResult.text,book:bibleResult.book || "",group:"Geral",background:"",theme:""})}>{busy ? "Enviando..." : "▶ Enviar para os telões"}</button>
        </div>}
        {!bibleStatus && !bibleResult && bibleReference.trim() && <p className="hint">Digite uma referência completa, como João 3:16 ou João 3:16-17.</p>}
        <p className="hint">A busca usa a Bíblia em português NVI. Pesquisar e visualizar nunca altera o conteúdo que está ao vivo.</p>
      </section>
      <section className="card">
        <small>BIBLIOTECA DO SPRESENTER</small><h2>Louvores cadastrados</h2>
        <label>Buscar música<input value={songQuery} onChange={e => setSongQuery(e.target.value)} placeholder="Digite o nome do louvor..." onKeyDown={e => { if (e.key === "Enter" && songQuery.trim()) { setSearchingSongs(true); postMessage({ type: "search-songs", query: songQuery.trim() }); } }} /></label>
        <button className="primary" disabled={!songQuery.trim() || searchingSongs} onClick={() => { setSearchingSongs(true); postMessage({ type: "search-songs", query: songQuery.trim() }); }}>{searchingSongs ? "Buscando..." : "Buscar louvores"}</button>
        {songs.map(song => <div className="verse" key={song.guid}><div className="verse-head"><div><strong>{song.title || song.name}</strong><small>{song.artist || song.author || "Louvor cadastrado"}</small></div><button className="go" onClick={() => postMessage({ type: "get-song-sections", guid: song.guid })}>Ver partes</button></div>
          {(songSections[song.guid] || []).map((section: any, index: number) => <button className="ghost" key={index} style={{margin:"5px 5px 0 0"}} onClick={() => postMessage({ type: "present-song", guid: song.guid, index, output, contentLayer })}>{section.type || "Parte"} {index + 1} — Apresentar</button>)}
          <button className="primary" style={{marginTop:8}} onClick={() => postMessage({ type: "present-song", guid: song.guid, index: 0, output, contentLayer })}>▶ Apresentar louvor</button>
        </div>)}
        {!songs.length && <p className="hint">Pesquise para listar as músicas encontradas na biblioteca do SPresenter.</p>}
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
