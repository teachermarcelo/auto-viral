const $=id=>document.getElementById(id);
const status=(text)=>$('status').textContent=text;
$('open').addEventListener('click',async()=>{
 const url=$('url').value.trim(),copy=$('copy').value.trim();
 try{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.hostname!=='www.facebook.com'||!parsed.pathname.startsWith('/groups/'))throw new Error('Informe uma URL válida de grupo do Facebook.');}
 catch(e){status(e.message||'URL inválida.');return;}
 if(!copy){status('Cole o texto da publicação antes de continuar.');return;}
 const task={url,title:'Tarefa AutoViral',copy,created_at:new Date().toISOString(),state:'ready'};
 await chrome.storage.local.set({activeTask:task});
 await chrome.tabs.create({url});
 status('Tarefa salva. No grupo, revise as regras e use o painel AutoViral para copiar o texto.');
});
$('capture').addEventListener('click',async()=>{
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.url||!/^https:\/\//.test(tab.url))throw new Error('Abra primeiro uma página pública https.');
  let selected='';
  try{const result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>window.getSelection()?.toString()||''});selected=result?.[0]?.result||'';}catch{}
  const item={url:tab.url,title:tab.title||'Página capturada',selected_text:selected,description:'Captura manual feita pelo usuário',signal:'Revisar manualmente',notes:'Captura feita com a extensão AutoViral AI.',created_at:new Date().toISOString()};
  const {captures=[]}=await chrome.storage.local.get('captures');captures.push(item);await chrome.storage.local.set({captures});
  status('Página capturada. Você poderá exportá-la e importar no Radar do AutoViral.');
 }catch(e){status(e.message||'Não foi possível capturar esta página.');}
});
$('export').addEventListener('click',async()=>{
 const {captures=[]}=await chrome.storage.local.get('captures');
 if(!captures.length){status('Nenhuma captura disponível para exportar.');return;}
 const blob=new Blob([JSON.stringify(captures,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='autoviral-capturas.json';a.click();URL.revokeObjectURL(url);
 status(captures.length+' captura(s) exportada(s). Importe o JSON em Grupos e oportunidades.');
});
(async()=>{const {activeTask}=await chrome.storage.local.get('activeTask');if(activeTask){$('url').value=activeTask.url||'';$('copy').value=activeTask.copy||'';}})();
