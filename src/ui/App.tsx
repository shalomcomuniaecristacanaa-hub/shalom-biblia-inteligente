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
  const [tab, setTab] = useState<"favorites" | "add" | "settings">("favorites");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [contextVerse, setContextVerse] = useState<string | null>(null);
  const [groupBackgrounds, setGroupBackgrounds] = useState({ Ceia: "", Palavra: "", "Dízimo": "" });

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
      }
      if (m.type === "captured") {
        setVerse(v => ({ ...v, reference: m.reference || "", book: m.book || "", text: m.text || "" }));
        setTab("add"); setNotice("Conteúdo importado da camada selecionada. Confira a referência e o texto antes de salvar.");
      }
      if (m.type === "presented") setNotice(m.background === "error" ? "Versículo apresentado. " + m.message : "Apresentado: " + m.reference);
      if (m.type === "notice" || m.type === "error") setNotice(m.message);
      if (m.type === "error") setBusy(false);
      if (m.type === "presented") setBusy(false);
    });
    postMessage({ type: "init" });
    return off;
  }, []);

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
      <button className={tab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")}>★ Favoritos</button>
      <button className={tab === "add" ? "active" : ""} onClick={() => { setTab("add"); if (!verse.id) setVerse(blank()); }}>＋ Adicionar</button>
      <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>⚙ Configuração</button>
    </nav>
    {notice && <div className="notice" onClick={() => setNotice("")}>{notice}<button>×</button></div>}
    {tab === "favorites" && <>
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
      <div className="importbox"><strong>Importar da Bíblia do SPresenter</strong><p>Abra a Bíblia nativa, coloque o versículo desejado na camada Conteúdo e importe o que estiver ao vivo.</p><div className="actions"><button className="ghost" onClick={() => postMessage({ type: "open-bible" })}>Abrir Bíblia do SPresenter</button><button className="primary" onClick={() => postMessage({ type: "capture-live", output, captureLayer })}>Importar do Conteúdo</button></div></div>
      <label>Livro bíblico<input value={verse.book || ""} onChange={e => setVerse({ ...verse, book: e.target.value })} placeholder="Preenchido automaticamente ao importar" /></label>\n      <label>Referência bíblica<input value={verse.reference} onChange={e => setVerse({ ...verse, reference: e.target.value })} placeholder="Ex.: João 3:16" /></label>
      <label>Texto do versículo<textarea rows={5} value={verse.text} onChange={e => setVerse({ ...verse, text: e.target.value })} placeholder="Cole ou digite o texto bíblico..." /></label>
      <div className="twocol"><label>Lista / categoria<input value={verse.group} onChange={e => setVerse({ ...verse, group: e.target.value })} placeholder="Ex.: Culto de domingo" /></label><label>Tema<input value={verse.theme} onChange={e => setVerse({ ...verse, theme: e.target.value })} placeholder="Ex.: Fé, esperança" /></label></div>
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
