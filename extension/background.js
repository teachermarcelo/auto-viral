chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(message?.type!=="AUTOVIRAL_OPEN_GROUP_TASK")return;
 (async()=>{
  const task=message.task||{};
  let parsed;
  try{parsed=new URL(task.url);}catch{throw new Error("URL do grupo inválida.");}
  if(parsed.protocol!=="https:"||parsed.hostname!=="www.facebook.com"||!parsed.pathname.startsWith("/groups/"))throw new Error("Somente URLs de grupos do Facebook são aceitas.");
  if(typeof task.copy!=="string"||!task.copy.trim())throw new Error("Texto da publicação vazio.");
  const activeTask={...task,url:parsed.href,created_at:new Date().toISOString(),state:"ready"};
  await chrome.storage.local.set({activeTask});
  await chrome.tabs.create({url:parsed.href,active:true});
  return {ok:true};
 })().then(sendResponse).catch(error=>sendResponse({ok:false,error:error.message||"Falha ao abrir tarefa."}));
 return true;
});
