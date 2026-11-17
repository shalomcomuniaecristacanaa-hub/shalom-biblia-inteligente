import { useEffect, useMemo, useState } from 'react';
import { onMessage, postMessage } from '@spresenter/plugin-sdk/ui';

type Verse = { id:string; reference:string; text:string; theme:string; notes:string };
type Status = { enabled:boolean; mode:'automatic'|'manual'; detected?:string; outputCount?:number };
export function App(){
 const [verses,setVerses]=useState<Verse[]>([]);
 const [reference,setReference]=useState('João 3:16');
 const [text,setText]=useState('');
 const [theme,setTheme]=useState('');
 const [notes,setNotes]=useState('');
 const [editing,setEditing]=useState<string|null>(null);
 const [status,setStatus]=useState<Status>({enabled:false,mode:'automatic'});
 const [tab,setTab]=useState<'verses'|'automation'>('verses');
 const [query,setQuery]=useState('');
 const filtered=useMemo(()=>verses.filter(v=>(v.reference+' '+v.text+' '+v.theme).toLowerCase().includes(query.toLowerCase())),[verses,query]);
 useEffect(()=>{const off=onMessage(raw=>{const m=raw as any;if(m.type==='state'){setVerses(m.verses||[]);setStatus(m.status||{enabled:false,mode:'automatic'});}if(m.type==='verses')setVerses(m.verses||[]);if(m.type==='status')setStatus(m.status);});postMessage({type:'init'});return off;},[]);
 function save(){if(!reference.trim()||!text.trim())return;const v={id:editing||Date.now().toString(36),reference:reference.trim(),text:text.trim(),theme:theme.trim(),notes:notes.trim()};postMessage({type:'save-verse',verse:v});setEditing(null);setReference('');setText('');setTheme('');setNotes('');}
 function edit(v:Verse){setEditing(v.id);setReference(v.reference);setText(v.text);setTheme(v.theme);setNotes(v.notes);window.scrollTo({top:0,behavior:'smooth'});}
 function cancel(){setEditing(null);setReference('');setText('');setTheme('');setNotes('');}
 return <main>
  <header><div className="mark">✦</div><div><strong>SHALOM</strong><span>BÍBLIA INTELIGENTE</span></div><i className={status.enabled?'online':''}/></header>
  <section className="hero"><small>ASSISTENTE DE PROJEÇÃO</small><h1>Prepare a Palavra.<br/><em>Inspire vidas.</em></h1><p>Organize os versículos e prepare fundos visuais para a ministração.</p></section>
  <nav><button className={tab==='verses'?'active':''} onClick={()=>setTab('verses')}>✧ Versículos</button><button className={tab==='automation'?'active':''} onClick={()=>setTab('automation')}>◉ Automação</button></nav>
  {tab==='verses'?<><section className="card"><div className="section-title"><div><small>BIBLIOTECA DA MINISTRAÇÃO</small><h2>{editing?'Editar versículo':'Cadastrar versículo'}</h2></div><span className="count">{verses.length} salvos</span></div>
   <label>Referência bíblica<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Ex.: Salmos 23:1"/></label>
   <label>Texto do versículo<textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Digite ou cole o texto bíblico..." rows={4}/></label>
   <label>Tema / palavra-chave<input value={theme} onChange={e=>setTheme(e.target.value)} placeholder="Ex.: confiança, fé, esperança"/></label>
   <label>Observações (opcional)<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Anotações para a equipe..." rows={2}/></label>
   <div className="actions"><button className="primary" onClick={save} disabled={!reference.trim()||!text.trim()}>{editing?'Salvar alterações':'＋ Adicionar à biblioteca'}</button>{editing&&<button className="ghost" onClick={cancel}>Cancelar</button>}</div>
  </section><section className="library"><div className="section-title"><div><small>SEUS TEXTOS</small><h2>Versículos cadastrados</h2></div></div><input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="⌕ Buscar referência, texto ou tema..."/>
   {filtered.length===0?<div className="empty">Sua biblioteca está vazia.<br/>Cadastre os versículos que serão usados no culto.</div>:filtered.map(v=><article className="verse" key={v.id}><div className="verse-head"><strong>{v.reference}</strong><div><button onClick={()=>edit(v)}>Editar</button><button className="danger" onClick={()=>postMessage({type:'delete-verse',id:v.id})}>Excluir</button></div></div><p>{v.text}</p>{v.theme&&<span className="tag">{v.theme}</span>}{v.notes&&<small className="notes">{v.notes}</small>}</article>)}
  </section></>:<section className="card"><small>CONTROLE INTELIGENTE</small><h2>Automação de fundos</h2><p className="muted">O painel acompanha o conteúdo ao vivo e pode relacioná-lo com os versículos cadastrados.</p><div className="switch-row"><div><strong>Ativar análise automática</strong><small>Detectar referências exibidas no SPresenter</small></div><input type="checkbox" checked={status.enabled} onChange={e=>postMessage({type:'set-enabled',enabled:e.target.checked})}/></div><label>Modo de operação<select value={status.mode} onChange={e=>postMessage({type:'set-mode',mode:e.target.value})}><option value="automatic">Automático</option><option value="manual">Manual</option></select></label><div className="status"><span className={status.enabled?'dot green':'dot'}/>{status.enabled?'Monitoramento ativado':'Monitoramento pausado'}</div><p className="muted">A aplicação de mídia na camada Fundo permanece protegida até validar o formato de apresentação e os recursos de mídia da sua versão do SPresenter.</p></section>}
  <footer>SHALOM COMUNIDADE CRISTÃ <span>•</span> v0.3.0</footer>
 </main>;
}