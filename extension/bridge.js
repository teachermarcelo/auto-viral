(() => {
 const APP_ORIGIN="https://teachermarcelo.github.io";
 if(location.origin!==APP_ORIGIN)return;
 window.addEventListener("message",async(event)=>{
  if(event.source!==window||event.origin!==APP_ORIGIN)return;
  const data=event.data;
  if(!data||data.source!=="AUTOVIRAL_WEB"||data.type!=="OPEN_GROUP_TASK"||typeof data.requestId!=="string")return;
  const reply=(result)=>window.postMessage({source:"AUTOVIRAL_EXTENSION",type:"TASK_RESULT",requestId:data.requestId,...result},"*");
  try{
   const result=await chrome.runtime.sendMessage({type:"AUTOVIRAL_OPEN_GROUP_TASK",task:data.task});
   reply(result||{ok:false,error:"A extensão não retornou confirmação."});
  }catch(error){reply({ok:false,error:error.message||"Extensão indisponível."});}
 });
})();
