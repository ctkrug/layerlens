(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const o of i)if(o.type==="childList")for(const a of o.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function s(i){const o={};return i.integrity&&(o.integrity=i.integrity),i.referrerPolicy&&(o.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?o.credentials="include":i.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(i){if(i.ep)return;i.ep=!0;const o=s(i);fetch(i.href,o)}})();const z=new Set(["FROM","RUN","CMD","LABEL","MAINTAINER","EXPOSE","ENV","ADD","COPY","ENTRYPOINT","VOLUME","USER","WORKDIR","ARG","ONBUILD","STOPSIGNAL","HEALTHCHECK","SHELL"]),U=/^#\s*escape\s*=\s*(\S)/i;function H(e){const t=[],s=e.split(/\r?\n/).map((l,d)=>({text:l,line:d+1})),n=_(s),i=V(s,t),o=B(i,n,t),a=[];let c=-1;for(const{text:l,line:d}of o){const h=/^\s*(\S+)\s*([\s\S]*)$/.exec(l);if(!h)continue;const u=h[1].toUpperCase(),f=h[2].trim();u==="FROM"?c+=1:c<0&&(u==="ARG"||t.push({line:d,message:`${u} appears before the first FROM`}),c=0),z.has(u)||t.push({line:d,message:`unknown instruction "${u}"`}),a.push({keyword:u,args:f,line:d,stage:Math.max(c,0)})}const r=a.filter(l=>l.keyword==="FROM").length||(a.length?1:0);return{instructions:a,stageCount:r,warnings:t}}function _(e){for(const{text:t}of e){const s=t.trim();if(s==="")continue;if(!s.startsWith("#"))break;const n=U.exec(s);if(n)return n[1]==="`"?"`":"\\";if(!/^#\s*\w+\s*=/.test(s))break}return"\\"}const k=/<<(-?)(["']?)([A-Za-z_][A-Za-z0-9_]*)\2/g;function q(e){const t=[];k.lastIndex=0;let s;for(;(s=k.exec(e))!==null;)t.push({word:s[3],stripTabs:s[1]==="-"});return t}function V(e,t){const s=[];for(let n=0;n<e.length;n++){const{text:i,line:o}=e[n];if(/^\s*#/.test(i)){s.push(e[n]);continue}const a=q(i);if(a.length===0){s.push(e[n]);continue}const c=[];let r=n+1,l=!1;for(const u of a){let f=!1;for(;r<e.length;){const p=e[r].text;if(r+=1,(u.stripTabs?p.replace(/^\t+/,""):p).trim()===u.word){f=!0;break}c.push(u.stripTabs?p.replace(/^\t+/,""):p)}if(!f){l=!0;break}}l&&t.push({line:o,message:`unterminated heredoc (expected \`${a[0].word}\`)`});const h=[i.replace(k,"").replace(/\s+/g," ").trim(),...c.map(u=>u.trim()).filter(u=>u!=="")].join(" ").trim();s.push({text:h,line:o}),n=r-1}return s}function B(e,t,s){const n=[];let i=null,o=0;for(const{text:a,line:c}of e){const r=/^\s*#/.test(a);if(i===null){if(a.trim()===""||r)continue;o=c,i=""}else if(r)continue;const l=K(a,t),d=l?a.slice(0,a.lastIndexOf(t)):a;i+=(i===""?"":" ")+d.trim(),l||(i.trim()!==""&&n.push({text:i,line:o}),i=null)}return i!==null&&i.trim()!==""&&(s.push({line:o,message:"line continuation at end of file"}),n.push({text:i,line:o})),n}function K(e,t){return e.replace(/\s+$/,"").endsWith(t)}const j=new Set(["RUN","COPY","ADD"]),G=[/\bapt(-get)?\s+install\b/,/\bapk\s+add\b/,/\byum\s+install\b/,/\bdnf\s+install\b/,/\bnpm\s+(ci|install|i)\b/,/\byarn\s+(install|add)\b/,/\bpnpm\s+(install|i|add)\b/,/\bpip\s+install\b/,/\bgem\s+install\b/,/\bgo\s+(build|install|mod\s+download)\b/,/\bcargo\s+(build|install|fetch)\b/,/\bmvn\b|\bgradle\b/];function E(e){const t=e.split(/\s+/).filter(s=>s.length>0&&!s.startsWith("--"));return t.length<=1?t:t.slice(0,-1)}function A(e){for(const t of e.split(/\s+/))if(!(t.length===0||t.startsWith("--")))return t;return""}function v(e){return E(e).some(t=>t==="."||t==="./"||t.includes("*"))}function D(e){return j.has(e)?"filesystem":"metadata"}function X(e){if(D(e.keyword)==="metadata")return{weight:0,note:"Metadata only — adds no filesystem content."};const t=e.args;return e.keyword==="RUN"?G.some(n=>n.test(t))?/rm\s+-rf?\s+\/var\/lib\/apt|--no-cache|clean\b/.test(t)?{weight:6,note:"Package install that cleans its caches — heavy but trimmed."}:{weight:9,note:"Package install without cache cleanup — likely bloats the image."}:{weight:2,note:"Shell command — size depends on what it writes."}:v(t)?{weight:7,note:"Copies a broad context (`.`/glob) — often the largest layer."}:e.keyword==="ADD"&&/^https?:\/\//.test(t)?{weight:4,note:"ADD of a remote URL — size unknown until fetched."}:{weight:3,note:"Copies specific paths — moderate, bounded size."}}function Z(e){return e.map((t,s)=>{const n=D(t.keyword),{weight:i,note:o}=X(t);return{index:s,instruction:t,kind:n,weight:i,sizeNote:o}})}function J(e){return e.reduce((t,s)=>t+s.weight,0)}function L(e){const t=new Map;for(const s of e){if(s.instruction.keyword!=="FROM")continue;const n=/\bAS\s+(\S+)/i.exec(s.instruction.args);n&&t.set(n[1].toLowerCase(),s.instruction.stage)}return t}function M(e,t){const s=/--from=(\S+)/.exec(e);if(!s)return null;const n=s[1].toLowerCase();return t.has(n)?t.get(n):/^\d+$/.test(n)?Number(n):null}function N(e,t){const s=L(e),n=new Map,i=c=>{if(c<0||c>=e.length)return!1;const r=e[c].instruction.stage,l=n.get(r);return l===void 0||c<l?(n.set(r,c),!0):!1};t.forEach(i);let o=!0;for(;o;){o=!1;for(const c of e){if(c.instruction.keyword!=="COPY")continue;const r=M(c.instruction.args,s);r!==null&&n.has(r)&&i(c.index)&&(o=!0)}}const a=new Set;for(const c of e){const r=n.get(c.instruction.stage);r!==void 0&&c.index>=r&&a.add(c.index)}return a}const P=/\b(npm\s+(ci|install|i)|yarn\s+install|pnpm\s+(install|i)|pip\s+install|bundle\s+install|go\s+mod\s+download|cargo\s+fetch)\b/,S={high:0,medium:1,low:2};function Q(e){return[...te(e),...ne(e),...ee(e),...ie(e),...oe(e),...ae(e)].sort((s,n)=>S[s.severity]-S[n.severity])}function T(e){const t=new Map;for(const s of e){const n=s.instruction;(n.keyword==="COPY"||n.keyword==="ADD")&&v(n.args)&&!t.has(n.stage)&&t.set(n.stage,s.index)}return t}function ee(e){const t=[],s=T(e);for(const n of e){const i=n.instruction;if(i.keyword!=="RUN"||n.weight<6||P.test(i.args))continue;const o=s.get(i.stage);if(o===void 0||n.index<=o)continue;const a=e[o].instruction;t.push({id:"order-sensitivity",severity:"medium",title:"A rarely-changing install sits below a broad COPY",line:i.line,estimatedSaving:n.weight,detail:`The install on line ${i.line} rebuilds whenever any source file changes, because \`${a.keyword} ${y(a.args)}\` on line ${a.line} runs first. Move this install above the broad COPY so it stays cached across code edits (relative weight ${n.weight}).`})}return t}function te(e){const t=[],s=T(e);for(const[n,i]of s){const o=e[i].instruction;for(let a=i+1;a<e.length;a++){const c=e[a].instruction;if(c.stage!==n)break;if(c.keyword==="RUN"&&P.test(c.args)){t.push({id:"copy-before-install",severity:"high",title:"Dependency install runs after a broad COPY — cache is wasted",line:o.line,estimatedSaving:e[a].weight,detail:`The \`${o.keyword} ${y(o.args)}\` on line ${o.line} invalidates the install on line ${c.line} whenever any source file changes. Copy only the dependency manifest first, run the install, then copy the rest — so the install layer (relative weight ${e[a].weight}) stays cached across code edits.`});break}}}return t}function ne(e){const t=[];for(const s of e){const n=s.instruction;n.keyword==="RUN"&&/\bapt(-get)?\s+install\b/.test(n.args)&&(/rm\s+-rf?\s+\/var\/lib\/apt\/lists|--no-install-recommends.*&&.*rm|apt(-get)?\s+clean/.test(n.args)||t.push({id:"apt-no-clean",severity:"medium",title:"apt install leaves package lists behind",line:n.line,detail:`The install on line ${n.line} does not remove \`/var/lib/apt/lists/*\` in the same RUN, so those lists ship in the image. Append \`&& rm -rf /var/lib/apt/lists/*\` to trim the layer.`}))}return t}const se=/\.(tar|tar\.gz|tgz|tar\.bz2|tar\.xz|tar\.zst|gz|bz2|xz)$/i;function ie(e){const t=[];for(const s of e){const n=s.instruction;if(n.keyword!=="ADD")continue;const i=E(n.args);i.some(o=>/^https?:\/\//.test(o))||i.some(o=>se.test(o))||t.push({id:"avoidable-add",severity:"low",title:"ADD used where COPY is clearer and safer",line:n.line,detail:`Line ${n.line} uses \`ADD\` for a local, non-archive path. ADD can fetch URLs and auto-extract archives, which surprises readers; for plain files prefer \`COPY\` — it is explicit and behaves identically here.`})}return t}function oe(e){const t=new Set;for(const n of e){if(n.instruction.keyword!=="FROM")continue;const i=/\bAS\s+(\S+)/i.exec(n.instruction.args);i&&t.add(i[1].toLowerCase())}const s=[];for(const n of e){const i=n.instruction;if(i.keyword!=="FROM")continue;const o=A(i.args),a=o.toLowerCase();if(a===""||a==="scratch"||t.has(a))continue;const c=o.split("/").pop();if(c.includes("@"))continue;const r=c.includes(":")?c.split(":")[1]:"";r!==""&&r!=="latest"||s.push({id:"floating-base-image",severity:"low",title:"Base image is not pinned to a version",line:i.line,detail:`\`FROM ${y(o)}\` on line ${i.line} ${r===""?"has no tag, so it defaults to :latest":"uses :latest"} — a rebuild can pull a different image without warning. Pin a specific version tag (or a @sha256 digest) for reproducible builds.`})}return s}function ae(e){const t=e.find(n=>(n.instruction.keyword==="COPY"||n.instruction.keyword==="ADD")&&v(n.instruction.args));if(!t)return[];const s=t.instruction;return[{id:"missing-dockerignore",severity:"low",title:"Broad COPY — make sure a .dockerignore exists",line:s.line,detail:`\`${s.keyword} ${y(s.args)}\` on line ${s.line} copies the whole build context. Add a \`.dockerignore\` (e.g. node_modules, .git, dist, .env) so local clutter neither bloats the image nor invalidates the cache on unrelated changes.`}]}function y(e,t=30){return e.length>t?e.slice(0,t-1)+"…":e}function re(e){const t=[],s=new Set;for(const n of e){const i=n.instruction;(i.keyword==="COPY"||i.keyword==="ADD")&&v(i.args)&&!s.has(i.stage)&&(s.add(i.stage),t.push(n.index))}return t}function ce(e){if(e.length===0)return 0;const t=e.reduce((s,n)=>Math.max(s,n.instruction.stage),0);return e.filter(s=>s.instruction.stage===t).reduce((s,n)=>s+n.weight,0)}function x(e){const t=H(e),s=Z(t.instructions);return le(s,t.warnings,t.stageCount)}function le(e,t,s){const n=re(e),i=N(e,n),o=e.map(r=>({...r,rebuildsOnSourceEdit:i.has(r.index)})),a=J(e),c=o.filter(r=>r.rebuildsOnSourceEdit).reduce((r,l)=>r+l.weight,0);return{layers:o,totalWeight:a,imageWeight:ce(e),wastedCacheRatio:a>0?c/a:0,sourceEditCascade:[...i].sort((r,l)=>r-l),suggestions:Q(e),warnings:t,stageCount:s}}const I=[{id:"node",label:"Node.js web app",dockerfile:`FROM node:18-slim
WORKDIR /app
COPY . .
RUN npm ci --production
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
`},{id:"python",label:"Python service",dockerfile:`FROM python:3.12
WORKDIR /srv
RUN apt-get update && apt-get install -y build-essential
COPY . .
RUN pip install -r requirements.txt
CMD ["python", "app.py"]
`},{id:"go-multistage",label:"Go multi-stage build",dockerfile:`FROM golang:1.22 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /bin/app ./cmd/app

FROM gcr.io/distroless/base
COPY --from=build /bin/app /app
ENTRYPOINT ["/app"]
`}];function ue(e){return I.find(t=>t.id===e)}const $=`# syntax=docker/dockerfile:1
FROM node:18-slim

RUN apt-get update && apt-get install -y curl git

WORKDIR /app

# Bug: copying everything before installing busts the cache on every edit.
COPY . .

RUN npm ci --production

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
`;function g(e){return e.replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function W(e,t,s=t+"s"){return e===1?t:s}function de(e,t){return e.length>t?e.slice(0,t-1)+"…":e}function b(e){return Math.round(e*100)}function fe(e,t,s=4){return t<=0?s:Math.max(s,Math.round(e/t*100))}function Y(e,t){const s=e.layers.find(a=>a.instruction.keyword==="FROM"&&a.instruction.stage===t);if(!s)return`stage ${t}`;const n=s.instruction.args,i=/\bAS\s+(\S+)/i.exec(n);return i?i[1]:A(n)||`stage ${t}`}function ge(e){const t=b(e.wastedCacheRatio);return`
    <div class="metric" data-metric="weight">
      <div class="value" data-value="${e.imageWeight}">${e.imageWeight}</div>
      <div class="label">relative image weight</div>
    </div>
    <div class="metric ${t>=50?"hot":""}" data-metric="wasted">
      <div class="value" data-value="${t}"><span class="num">${t}</span><span class="unit">%</span></div>
      <div class="label">rebuilds on a source edit</div>
    </div>
    <div class="metric" data-metric="stages">
      <div class="value" data-value="${e.stageCount}">${e.stageCount}</div>
      <div class="label">build ${W(e.stageCount,"stage")}</div>
    </div>`}function pe(e,t,s){const n=fe(e.weight,t),i=e.rebuildsOnSourceEdit?"rebuilds":e.kind==="metadata"?"metadata":"cached",o=i==="rebuilds"?"rebuilds on edit":i==="metadata"?"metadata":"stays cached",a=s?`<span class="edge" title="pulls from stage ${g(s)}">↖ ${g(s)}</span>`:"";return`<button type="button" class="layer ${i}${s?" cross":""}" data-index="${e.index}"
      aria-label="Layer ${e.index}: ${g(e.instruction.keyword)}${s?` from stage ${g(s)}`:""} — ${g(o)}. ${g(e.sizeNote)}">
      <span class="idx">L${e.index}</span>
      <span class="instr"><span class="keyword">${g(e.instruction.keyword)}</span> ${g(de(e.instruction.args,52))}${a}</span>
      <span class="track"><span class="bar" style="width:${n}%"></span></span>
      <span class="chip">${o}</span>
    </button>`}function he(e,t,s){if(t.instruction.keyword!=="COPY")return null;const n=M(t.instruction.args,s);return n===null?null:Y(e,n)}function me(e){if(e.layers.length===0)return be();const t=e.layers.reduce((i,o)=>Math.max(i,o.weight),1),s=L(e.layers),n=[...new Set(e.layers.map(i=>i.instruction.stage))].sort((i,o)=>i-o);return n.map(i=>{const o=e.layers.filter(r=>r.instruction.stage===i),c=n.length>1?`<div class="stage-head"><span class="stage-tag">stage ${i}</span><span class="stage-name">${g(Y(e,i))}</span></div>`:"";return`<section class="stage" data-stage="${i}">${c}
        ${o.map(r=>pe(r,t,he(e,r,s))).join("")}
      </section>`}).join("")}function be(){return`<div class="empty">
      <div class="empty-mark" aria-hidden="true">▤▤▤</div>
      <p>Paste a Dockerfile on the left to see its layer stack.</p>
    </div>`}function we(e){return e.suggestions.length===0?`<div class="suggestion empty-note">
        <span class="sev ok">clean</span>
        <h3>No cache or size issues found</h3>
        <p>This Dockerfile is well ordered — dependencies install before the broad copy,
        and nothing obvious bloats the image.</p>
      </div>`:e.suggestions.map(t=>`<div class="suggestion ${t.severity}" data-line="${t.line}">
        <span class="sev">${t.severity} · line ${t.line}</span>
        <h3>${g(t.title)}</h3>
        <p>${g(t.detail)}</p>
      </div>`).join("")}function ve(e){if(e.warnings.length===0)return"";const t=e.warnings.map(s=>`<li>line ${s.line}: ${g(s.message)}</li>`).join("");return`<div class="notice" role="status">
      <strong>${e.warnings.length} parse ${W(e.warnings.length,"note")}</strong>
      <ul>${t}</ul>
    </div>`}function ye(e){const t=Se(e);return 1-Math.pow(1-t,3)}function ke(e,t,s){return Math.round(e+(t-e)*ye(s))}function Se(e){return e<0?0:e>1?1:e}function xe(){return typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches}function F(e,t,s,n={}){const i=n.from??(parseInt(e.dataset.value??"0",10)||0),o=n.durationMs??600;if(e.dataset.value=String(t),i===t||xe()||typeof requestAnimationFrame!="function")return e.textContent=s(t),()=>{};let a=0,c=-1;const r=l=>{c<0&&(c=l);const d=(l-c)/o;e.textContent=s(ke(i,t,d)),d<1?a=requestAnimationFrame(r):e.textContent=s(t)};return a=requestAnimationFrame(r),()=>cancelAnimationFrame(a)}const R="layerlens:sound";function $e(){if(typeof window>"u")return null;const e=window;return e.AudioContext??e.webkitAudioContext??null}function Re(e=Oe()){const t=()=>{try{return e?.getItem(R)??null}catch{return null}},s=l=>{try{e?.setItem(R,l)}catch{}};let n=t()==="on";const i=$e();let o=null,a=0;const c=()=>{if(!i)return null;if(!o)try{o=new i}catch{return null}return o},r=(l,d,h,u)=>{if(!n)return;const f=c();if(f)try{const p=f.currentTime,m=f.createOscillator(),w=f.createGain();m.type=h,m.frequency.setValueAtTime(l,p),w.gain.setValueAtTime(1e-4,p),w.gain.exponentialRampToValueAtTime(u,p+.008),w.gain.exponentialRampToValueAtTime(1e-4,p+d/1e3),m.connect(w).connect(f.destination),m.start(p),m.stop(p+d/1e3+.02)}catch{}};return{enabled:()=>n,toggle:()=>(n=!n,s(n?"on":"off"),n),tick:()=>{const l=Ce();l-a<45||(a=l,r(880,40,"triangle",.05))},clunk:()=>r(150,130,"sawtooth",.08)}}function Ce(){return typeof performance<"u"?performance.now():0}function Oe(){try{return typeof localStorage<"u"?localStorage:null}catch{return null}}function Ee(e){e.innerHTML=Te();const t=Pe(e),s=Re();Le(e,s);let n=x($),i={weight:0,wasted:0,stages:0};const o=()=>{n=x(t.textarea.value),t.metrics.innerHTML=ge(n),t.stack.innerHTML=me(n),t.suggestions.innerHTML=we(n),t.notice.innerHTML=ve(n),Ne(t),Ae(t,n,i),i={weight:n.imageWeight,wasted:b(n.wastedCacheRatio),stages:n.stageCount},De(t,()=>n,s)};t.textarea.value=$,t.textarea.addEventListener("input",o),t.textarea.addEventListener("scroll",()=>{t.gutter.scrollTop=t.textarea.scrollTop}),Me(e,t,o),o()}function Ae(e,t,s){C(e.metrics,"weight",t.imageWeight,s.weight),C(e.metrics,"stages",t.stageCount,s.stages);const n=e.metrics.querySelector('[data-metric="wasted"] .num');n&&F(n,b(t.wastedCacheRatio),String,{from:s.wasted})}function C(e,t,s,n){const i=e.querySelector(`[data-metric="${t}"] .value`);i&&F(i,s,String,{from:n})}function De(e,t,s){const n=[...e.stack.querySelectorAll(".layer")],i=e.metrics.querySelector('[data-metric="wasted"] .num'),o=b(t().wastedCacheRatio),a=r=>{const l=t(),d=N(l.layers,[r]);let h=0;for(const u of n){const f=Number(u.dataset.index);u.classList.toggle("sweep",d.has(f)),d.has(f)&&(h+=l.layers[f]?.weight??0)}i&&(i.textContent=String(l.totalWeight>0?b(h/l.totalWeight):0)),s.tick(),d.size>1&&s.clunk()},c=()=>{for(const r of n)r.classList.remove("sweep");i&&(i.textContent=String(o))};for(const r of n){const l=Number(r.dataset.index);r.addEventListener("mouseenter",()=>a(l)),r.addEventListener("focus",()=>a(l)),r.addEventListener("mouseleave",c),r.addEventListener("blur",c)}}function Le(e,t){const s=e.querySelector(".sound-toggle");if(!s)return;const n=()=>{const i=t.enabled();s.setAttribute("aria-pressed",String(i)),s.dataset.on=String(i),s.textContent=i?"♪ sound on":"♪ sound off"};s.addEventListener("click",()=>{t.toggle(),n()}),n()}function Me(e,t,s){for(const n of e.querySelectorAll("[data-example]"))n.addEventListener("click",()=>{const i=ue(n.dataset.example??"");i&&(t.textarea.value=i.dockerfile,s(),t.textarea.focus())})}function Ne(e){const t=e.textarea.value.split(`
`).length;e.gutter.innerHTML=Array.from({length:t},(s,n)=>`<span>${n+1}</span>`).join("")}function Pe(e){const t=s=>e.querySelector(s);return{textarea:t(".editor textarea"),gutter:t(".gutter"),metrics:t(".metrics"),stack:t(".stack"),suggestions:t(".suggestions"),notice:t(".notice-slot")}}function Te(){return`
    <header class="topbar">
      <div class="brand">
        <div class="wordmark">layer<span class="lens">lens</span></div>
        <p class="tagline">Paste a Dockerfile. See which layers rebuild on a code change, and the reorder that keeps them cached.</p>
      </div>
      <div class="controls">
        <div class="examples" role="group" aria-label="Load an example Dockerfile">
          <span class="examples-label">try:</span>${I.map(t=>`<button type="button" class="example" data-example="${t.id}">${t.label}</button>`).join("")}
        </div>
        <button type="button" class="sound-toggle" aria-pressed="false" aria-label="Toggle sound effects">♪ sound off</button>
      </div>
    </header>
    <main class="workbench">
      <section class="editor-pane" aria-label="Dockerfile editor">
        <div class="editor">
          <div class="gutter" aria-hidden="true"></div>
          <textarea spellcheck="false" autocapitalize="off" autocomplete="off"
            aria-label="Dockerfile source" placeholder="FROM node:20-slim&#10;WORKDIR /app&#10;COPY . .&#10;RUN npm ci"></textarea>
        </div>
        <div class="notice-slot" aria-live="polite"></div>
      </section>
      <section class="viz-pane" aria-label="Layer analysis">
        <div class="metrics"></div>
        <h2 class="pane-title">Layer stack</h2>
        <div class="stack"></div>
        <div class="annotations">
          <h2 class="pane-title">Suggestions</h2>
          <div class="suggestions"></div>
        </div>
      </section>
    </main>`}const O=document.getElementById("app");O&&Ee(O);
