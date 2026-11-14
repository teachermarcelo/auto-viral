(() => {
 if (window.top !== window) return;
 const ROOT_ID='autoviral-assist-panel';
 if(document.getElementById(ROOT_ID))return;
 const render=async()=>{
  const {activeTask}=await chrome.storage.local.get('activeTask');
  if(!activeTask||activeTask.url.replace(/\/$/,'')!==location.href.split('?')[0].replace(/\/$/,''))return;
  if(document.getElementById(ROOT_ID))return;
  const host=document.createElement('div');host.id=ROOT_ID;
  const shadow=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');style.textContent=`
   :host{all:initial;position:fixed;z-index:2147483647;right:18px;bottom:18px;font-family:Arial,sans-serif;color:#f8f8ff}
   .panel{width:300px;background:#17182a;border:1px solid #6250b7;border-radius:14px;box-shadow:0 12px 40px #0008;padding:14px}
   .head{font-weight:800;color:#b7a8ff;font-size:12px;letter-spacing:1px;margin-bottom:8px}
   p{font:12px/1.5 Arial;color:#d0d2e5;margin:0 0 10px}
   button{width:100%;padding:10px;border:0;border-radius:8px;background:#7958ee;color:white;font-weight:700;cursor:pointer;margin-top:7px}
   button.alt{background:#303149;border:1px solid #4b4d68}
   .note{font-size:10px;color:#a6aac2;margin-top:9px;line-height:1.4}
   .close{position:absolute;right:22px;top:20px;width:auto;padding:3px 8px;background:#303149}
  `;
  const panel=document.createElement('section');panel.className='panel';
  panel.innerHTML='<div class="head">AUTOVIRAL · TAREFA ATIVA</div><p>Confira as regras do grupo. Solicite entrada ou publique somente se tiver autorização.</p><button id="copy">Copiar texto da campanha</button><button class="alt" id="done">Marcar tarefa como revisada</button><div class="note">A extensão não clica em Entrar, não envia publicação e não contorna aprovações. Você mantém o controle da sua conta.</div>';
  shadow.append(style,panel);document.documentElement.append(host);
  shadow.getElementById('copy').addEventListener('click',async()=>{
   try{await navigator.clipboard.writeText(activeTask.copy||'');shadow.getElementById('copy').textContent='Texto copiado ✓';}
   catch{shadow.getElementById('copy').textContent='Permita a cópia no navegador';}
  });
  shadow.getElementById('done').addEventListener('click',async()=>{
   await chrome.storage.local.set({activeTask:{...activeTask,state:'reviewed',reviewed_at:new Date().toISOString()}});
   shadow.getElementById('done').textContent='Revisão registrada ✓';
  });
 };
 render();chrome.storage.onChanged.addListener(()=>{document.getElementById(ROOT_ID)?.remove();render();});
})();
