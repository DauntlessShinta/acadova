// Synthetic browser HTTP fixtures must intercept XHR as well as fetch. These
// explicit test events do not claim real network transfer or provider access.
export function installUploadMock({ delayMs = 0 } = {}) {
  window.XMLHttpRequest = class {
    constructor(){this.upload={};this.headers={};this.aborted=false;}
    open(method,url){this.method=method;this.url=url;}
    setRequestHeader(name,value){this.headers[name]=value;}
    abort(){this.aborted=true;this.onabort?.();}
    async send(body){
      try{
        const total=body instanceof FormData?[...body.values()].reduce((sum,value)=>sum+(value instanceof Blob?value.size:new TextEncoder().encode(String(value)).length),0):0;
        if(total)this.upload.onprogress?.({loaded:Math.floor(total/2),total,lengthComputable:true});
        if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));
        if(this.aborted)return;
        if(total)this.upload.onprogress?.({loaded:total,total,lengthComputable:true});
        const response=await window.fetch(this.url,{method:this.method,headers:this.headers,body});
        if(this.aborted)return;this.status=response.status;this.responseText=await response.text();this.onload?.();
      }catch{if(!this.aborted)this.onerror?.();}
    }
  };
}
