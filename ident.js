/* "Welcome to IMC" logo reveals, drawn on a canvas.
   Shared by the hub's maker (index.html) and the foyer player (foyer.html), so what you design is exactly what the TVs play.
   IMCIdent.draw(ctx, W, H, t, cfg, assets) draws one frame; t runs 0 → 1 over the reveal. */
(function(){
const TAU=Math.PI*2,cl=x=>Math.max(0,Math.min(1,x)),eo=x=>1-Math.pow(1-cl(x),3),eio=x=>{x=cl(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2};
const back=x=>{x=cl(x);const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)};
const seg=(t,a,b)=>cl((t-a)/(b-a));
function rng(seed){return()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function rgb(h){h=String(h||"#000").replace("#","");if(h.length===3)h=h.split("").map(c=>c+c).join("");const n=parseInt(h,16)||0;return[n>>16&255,n>>8&255,n&255]}
const rgba=(h,a)=>`rgba(${rgb(h).join(",")},${a})`;
const F={display:'"Big Shoulders Display","Arial Narrow",Impact,sans-serif',body:'"Figtree",system-ui,sans-serif',mono:'"IBM Plex Mono",ui-monospace,monospace'};

const THEMES={
  midnight:{n:"Midnight blue",a:"#16205a",b:"#050716"},
  imc:{n:"IMC blue",a:"#1fa0de",b:"#0a1d52"},
  velvet:{n:"Red velvet",a:"#5e0d1c",b:"#12030a"},
  gold:{n:"Black & gold",a:"#3a2a0c",b:"#050403"},
  purple:{n:"Premiere purple",a:"#3a2560",b:"#0b0718"},
  black:{n:"Pure black",a:"#141414",b:"#000000"}
};
const DEFAULT={name:"Welcome",style:"spotlight",kicker:"WELCOME TO",title:"IMC CINEMAS",msg:"Sit back, relax and enjoy the show",theme:"midnight",accent:"#ffd84a",extra:"none",dur:8,on:true};

function bg(c,W,H,cfg){const th=THEMES[cfg.theme]||THEMES.midnight,g=c.createRadialGradient(W/2,H*.42,0,W/2,H*.42,Math.hypot(W,H)*.62);g.addColorStop(0,th.a);g.addColorStop(1,th.b);c.fillStyle=g;c.fillRect(0,0,W,H)}
function logo(c,A,x,y,h,o={}){const a=o.a??1;if(a<=0)return;c.save();c.globalAlpha*=a;c.translate(x,y);c.rotate(o.r||0);c.scale(o.s??1,o.s??1);
  if(o.glow){c.shadowColor=o.glowCol||"rgba(255,216,74,.9)";c.shadowBlur=o.glow}
  if(A&&A.logo){const w=h*A.logo.width/A.logo.height;c.drawImage(A.logo,-w/2,-h/2,w,h)}
  else{c.fillStyle="#1fa0de";c.beginPath();c.arc(0,0,h/2,0,TAU);c.fill();c.shadowBlur=0;c.fillStyle="#fff";c.font=`900 ${h*.42}px ${F.display}`;c.textAlign="center";c.textBaseline="middle";c.fillText("IMC",0,h*.03)}
  c.restore()}
function fitFont(c,text,weight,family,max,width){let z=max;for(;z>12;z-=2){c.font=`${weight} ${z}px ${family}`;if(c.measureText(text).width<=width)break}return z}
/* the three lines under the logo; p runs 0 → 1 as they arrive */
function words(c,W,H,cfg,p,y0){if(p<=0)return;const u=H/1080,base=y0??H*.665;c.save();c.textAlign="center";c.textBaseline="alphabetic";
  const line=(txt,k,draw)=>{const q=eo(seg(p,k,k+.45));if(q<=0||!txt)return;c.globalAlpha=q;c.save();c.translate(0,(1-q)*24*u);draw(txt);c.restore()};
  line(String(cfg.kicker||"").toUpperCase(),0,s=>{c.fillStyle=cfg.accent||"#ffd84a";c.font=`500 ${38*u}px ${F.mono}`;c.letterSpacing=`${12*u}px`;c.fillText(s,W/2+5*u,base);c.letterSpacing="0px"});
  line(String(cfg.title||"").toUpperCase(),.2,s=>{const z=fitFont(c,s,900,F.display,150*u,W*.84);c.fillStyle="#fff";c.shadowColor="rgba(0,0,0,.55)";c.shadowBlur=24*u;c.fillText(s,W/2,base+z*.95)});
  line(cfg.msg,.4,s=>{const z=fitFont(c,s,600,F.body,52*u,W*.8);c.fillStyle="rgba(235,240,255,.88)";c.font=`600 ${z}px ${F.body}`;c.fillText(s,W/2,base+225*u)});
  c.restore()}
function kernel(c,x,y,r,rot){c.save();c.translate(x,y);c.rotate(rot);const g=c.createRadialGradient(-r*.3,-r*.3,r*.1,0,0,r*1.2);g.addColorStop(0,"#fffdf3");g.addColorStop(.7,"#fbeec6");g.addColorStop(1,"#e0b35a");c.fillStyle=g;
  [[0,0,1],[.55,-.35,.7],[-.5,-.4,.75],[.4,.5,.65],[-.45,.45,.6]].forEach(([a,b,k])=>{c.beginPath();c.arc(a*r,b*r,r*k*.75,0,TAU);c.fill()});c.fillStyle="#d48a2a";c.beginPath();c.arc(r*.1,r*.15,r*.16,0,TAU);c.fill();c.restore()}
function sparkle(c,x,y,s,a,col){if(a<=.02)return;c.save();c.globalAlpha=a;c.globalCompositeOperation="lighter";const g=c.createRadialGradient(x,y,0,x,y,s*1.4);g.addColorStop(0,rgba(col,.8));g.addColorStop(1,rgba(col,0));c.fillStyle=g;c.beginPath();c.arc(x,y,s*1.4,0,TAU);c.fill();
  c.fillStyle="#fffaf0";const q=s*.13;c.beginPath();[[0,-s],[q,-q],[s,0],[q,q],[0,s],[-q,q],[-s,0],[-q,-q]].forEach(([px,py],j)=>j?c.lineTo(x+px,y+py):c.moveTo(x+px,y+py));c.closePath();c.fill();c.restore()}
function sparkles(c,W,H,t,n,col,from){const r=rng(9);for(let i=0;i<n;i++){const x=r()*W,y=r()*H,s=(10+r()*22)*H/1080,ph=r();if(t<from)continue;const a=Math.pow(Math.max(0,Math.sin(Math.PI*((t*3+ph)%1))),6);sparkle(c,x,y,s,a,col)}}

/* ---------- the reveals ---------- */
const STYLES={
  spotlight:{n:"Spotlight reveal",text:.5,draw(c,W,H,t,cfg,A){const u=H/1080,lx=W/2,ly=H*.4;bg(c,W,H,cfg);c.fillStyle="rgba(0,0,0,.45)";c.fillRect(0,0,W,H);
    const aim=eio(seg(t,.04,.36)),fade=1-seg(t,.5,.75)*.7;c.save();c.globalCompositeOperation="screen";
    for(const side of[-1,1]){const ox=W/2+side*W*.42,oy=H+40*u,startA=-Math.PI/2+side*.75,target=Math.atan2(ly-oy,lx-ox),a=startA+(target-startA)*aim+Math.sin(t*9+side)*.04*(1-aim),L=Math.hypot(W,H),hw=.07;
      const g=c.createLinearGradient(ox,oy,ox+Math.cos(a)*L,oy+Math.sin(a)*L);g.addColorStop(0,`rgba(255,244,214,${.55*fade})`);g.addColorStop(.6,`rgba(255,236,190,${.16*fade})`);g.addColorStop(1,"rgba(255,236,190,0)");c.fillStyle=g;
      c.beginPath();c.moveTo(ox-14*u,oy);c.lineTo(ox+Math.cos(a-hw)*L,oy+Math.sin(a-hw)*L);c.lineTo(ox+Math.cos(a+hw)*L,oy+Math.sin(a+hw)*L);c.lineTo(ox+14*u,oy);c.closePath();c.fill()}
    const pool=eo(seg(t,.3,.5)),pg=c.createRadialGradient(lx,ly,0,lx,ly,H*.45);pg.addColorStop(0,`rgba(255,240,205,${.45*pool})`);pg.addColorStop(1,"rgba(255,240,205,0)");c.fillStyle=pg;c.beginPath();c.arc(lx,ly,H*.45,0,TAU);c.fill();c.restore();
    logo(c,A,lx,ly,H*.36,{a:eo(seg(t,.3,.46)),s:.92+.08*eo(seg(t,.3,.6)),glow:30*u*pool})}},
  curtain:{n:"Curtain up",text:.42,draw(c,W,H,t,cfg,A){const u=H/1080,col=cfg.curtain||"#9e0f1f";bg(c,W,H,cfg);sparkles(c,W,H,t,26,cfg.accent,.3);
    logo(c,A,W/2,H*.4,H*.36,{s:.94+.06*eo(seg(t,.2,.6)),glow:24*u});
    const o=eio(seg(t,.08,.42)),side=W*.05+W*.45*(1-o);
    const half=w=>{const g=c.createLinearGradient(0,0,w,0),n=Math.max(3,Math.round(w/(60*u)));for(let i=0;i<=n;i++)g.addColorStop(i/n,i%2?rgba(col,1):"#000");c.fillStyle=col;c.beginPath();c.moveTo(0,0);c.lineTo(w,0);c.quadraticCurveTo(w*(1+.06*o),H*.55,w*(1-.35*o),H);c.lineTo(0,H);c.closePath();c.fill();
      c.globalAlpha=.45;c.fillStyle=g;c.fill();c.globalAlpha=1;const sh=c.createLinearGradient(0,0,0,H);sh.addColorStop(0,"rgba(0,0,0,.35)");sh.addColorStop(.3,"rgba(0,0,0,0)");sh.addColorStop(1,"rgba(0,0,0,.4)");c.fillStyle=sh;c.fill();
      if(o>.5){c.fillStyle="#ffc23d";c.globalAlpha=(o-.5)*2;c.fillRect(0,H*.6-5*u,w*(1-.12*o),10*u);c.globalAlpha=1}};
    half(side);c.save();c.translate(W,0);c.scale(-1,1);half(side);c.restore();
    const vh=H*.09,sc=W/10,val=()=>{c.beginPath();c.moveTo(0,vh);for(let x=0;x<W;x+=sc)c.quadraticCurveTo(x+sc/2,vh+30*u,x+sc,vh)};c.fillStyle=col;val();c.lineTo(W,0);c.lineTo(0,0);c.closePath();c.fill();c.fillStyle="rgba(0,0,0,.3)";c.fill();c.strokeStyle="#ffc23d";c.lineWidth=6*u;val();c.stroke()}},
  countdown:{n:"Film countdown",text:.5,draw(c,W,H,t,cfg,A){const u=H/1080;bg(c,W,H,cfg);
    if(t<.36){const q=t/.36,n=3-Math.floor(q*3),p=(q*3)%1,cx=W/2,cy=H/2,R=H*.34;c.fillStyle="rgba(22,22,24,.92)";c.fillRect(0,0,W,H);c.strokeStyle="rgba(255,255,255,.55)";c.lineWidth=5*u;
      c.beginPath();c.arc(cx,cy,R,0,TAU);c.stroke();c.beginPath();c.arc(cx,cy,R*.82,0,TAU);c.stroke();c.beginPath();c.moveTo(cx-R*1.6,cy);c.lineTo(cx+R*1.6,cy);c.moveTo(cx,cy-R*1.3);c.lineTo(cx,cy+R*1.3);c.stroke();
      c.fillStyle="rgba(255,255,255,.16)";c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,R*1.6,-Math.PI/2,-Math.PI/2+TAU*p);c.closePath();c.fill();
      c.fillStyle="#fff";c.font=`900 ${R*1.2}px ${F.display}`;c.textAlign="center";c.textBaseline="middle";c.fillText(String(n),cx,cy+R*.06);
      const r=rng(Math.floor(t*240));c.strokeStyle="rgba(255,255,255,.25)";c.lineWidth=2*u;if(r()<.6){const x=r()*W;c.beginPath();c.moveTo(x,0);c.lineTo(x+r()*20-10,H);c.stroke()}return}
    const fl=1-seg(t,.36,.44);sparkles(c,W,H,t,20,cfg.accent,.4);logo(c,A,W/2,H*.4,H*.36,{s:Math.max(.05,back(seg(t,.37,.5))),glow:28*u});
    if(fl>0){c.fillStyle=`rgba(255,255,255,${fl*.85})`;c.fillRect(0,0,W,H)}}},
  flare:{n:"Lens flare wipe",text:.5,draw(c,W,H,t,cfg,A){const u=H/1080,p=eio(seg(t,.08,.5)),fx=-W*.15+p*W*1.3,fy=H*.4;bg(c,W,H,cfg);
    c.save();c.beginPath();c.rect(0,0,Math.max(0,fx),H);c.clip();logo(c,A,W/2,H*.4,H*.36,{glow:20*u});c.restore();
    const col=rgb(cfg.accent==="#ffd84a"?"#8cc8ff":cfg.accent).join(","),vis=t<.62?1:1-seg(t,.62,.75);if(vis<=0)return;c.save();c.globalCompositeOperation="screen";c.globalAlpha=vis;
    let g=c.createRadialGradient(fx,fy,0,fx,fy,260*u);g.addColorStop(0,"rgba(255,255,255,.95)");g.addColorStop(.2,`rgba(${col},.5)`);g.addColorStop(1,`rgba(${col},0)`);c.fillStyle=g;c.beginPath();c.arc(fx,fy,260*u,0,TAU);c.fill();
    g=c.createLinearGradient(fx-W*.8,0,fx+W*.8,0);g.addColorStop(0,`rgba(${col},0)`);g.addColorStop(.5,`rgba(${col},.85)`);g.addColorStop(1,`rgba(${col},0)`);c.fillStyle=g;c.fillRect(fx-W*.8,fy-4*u,W*1.6,8*u);
    [[.4,46,.18],[.75,26,.25],[1.3,70,.12],[1.6,34,.2]].forEach(([k,rr,a])=>{const gx=fx+(W/2-fx)*k*1.3,gy=fy+(H/2-fy)*k*1.3;c.fillStyle=`rgba(${col},${a})`;c.beginPath();for(let j=0;j<6;j++){const an=j*TAU/6;c.lineTo(gx+Math.cos(an)*rr*u,gy+Math.sin(an)*rr*u)}c.closePath();c.fill()});c.restore()}},
  popcorn:{n:"Popcorn burst",text:.45,draw(c,W,H,t,cfg,A){const u=H/1080,cx=W/2,cy=H*.4;bg(c,W,H,cfg);
    const rays=eo(seg(t,.15,.4));if(rays>0){c.save();c.translate(cx,cy);c.rotate(t*.6);c.globalCompositeOperation="screen";const g=c.createRadialGradient(0,0,0,0,0,H);g.addColorStop(0,rgba(cfg.accent,.35*rays));g.addColorStop(1,rgba(cfg.accent,0));c.fillStyle=g;for(let i=0;i<16;i++){const a=i*TAU/16;c.beginPath();c.moveTo(0,0);c.arc(0,0,W,a,a+TAU/32);c.closePath();c.fill()}c.restore()}
    const r=rng(3);for(let i=0;i<70;i++){const a=r()*TAU,v=(500+r()*900)*u,sz=(12+r()*14)*u,rot=r()*TAU,d=seg(t,.18,1)*1.6,x=cx+Math.cos(a)*v*d,y=cy+Math.sin(a)*v*d*.8+900*u*d*d;if(d<=0||y>H+50*u)continue;kernel(c,x,y,sz,rot+d*6*(r()-.5))}
    logo(c,A,cx,cy,H*.36,{s:Math.max(.05,back(seg(t,.1,.3))),r:(1-eo(seg(t,.1,.35)))*-.4,glow:24*u})}},
  warp:{n:"Starfield zoom",text:.5,draw(c,W,H,t,cfg,A){const u=H/1080,cx=W/2,cy=H*.4;c.fillStyle="#020310";c.fillRect(0,0,W,H);bg(c,W,H,{...cfg});c.fillStyle="rgba(0,0,0,.6)";c.fillRect(0,0,W,H);
    const sp=t<.35?Math.pow(t/.35,2):Math.max(0,1-(t-.35)/.15),r=rng(5);c.save();c.lineCap="round";
    for(let i=0;i<260;i++){const a=r()*TAU,d0=r(),z=((d0+t*1.6)%1),R=Math.pow(z,2.2)*Math.hypot(W,H)*.7,x=cx+Math.cos(a)*R,y=cy+Math.sin(a)*R,len=sp*R*.35+2*u;c.strokeStyle=`rgba(220,235,255,${.25+.75*z})`;c.lineWidth=(1+z*3)*u;c.beginPath();c.moveTo(x,y);c.lineTo(x-Math.cos(a)*len,y-Math.sin(a)*len);c.stroke()}c.restore();
    const fl=seg(t,.36,.4)*(1-seg(t,.4,.5));if(fl>0){c.fillStyle=`rgba(255,255,255,${fl*.8})`;c.fillRect(0,0,W,H)}
    logo(c,A,cx,cy,H*.36,{a:eo(seg(t,.3,.4)),s:.05+.95*eo(seg(t,.3,.48)),glow:30*u})}},
  marquee:{n:"Marquee lights",text:.42,draw(c,W,H,t,cfg,A){const u=H/1080,bw=W*.42,bh=H*.42,x0=W/2-bw/2,y0=H*.385-bh/2;bg(c,W,H,cfg);
    c.save();c.shadowColor="rgba(0,0,0,.6)";c.shadowBlur=40*u;c.fillStyle="#120c24";c.beginPath();c.roundRect?c.roundRect(x0,y0,bw,bh,26*u):c.rect(x0,y0,bw,bh);c.fill();c.restore();c.strokeStyle=cfg.accent;c.lineWidth=6*u;c.beginPath();c.roundRect?c.roundRect(x0+18*u,y0+18*u,bw-36*u,bh-36*u,16*u):c.rect(x0+18*u,y0+18*u,bw-36*u,bh-36*u);c.stroke();
    const pts=[],gap=46*u,per=2*(bw+bh);for(let d=0;d<per;d+=gap){let x,y;if(d<bw){x=x0+d;y=y0}else if(d<bw+bh){x=x0+bw;y=y0+d-bw}else if(d<2*bw+bh){x=x0+bw-(d-bw-bh);y=y0+bh}else{x=x0;y=y0+bh-(d-2*bw-bh)}pts.push([x,y])}
    const on=seg(t,.04,.36)*pts.length;pts.forEach(([x,y],i)=>{const lit=i<on,chase=t>.36?(Math.floor(t*40)+i)%3!==0:true,a=lit?(chase?1:.35):.12;c.save();c.globalAlpha=a;if(lit&&chase){c.shadowColor="#ffe9a8";c.shadowBlur=20*u}c.fillStyle=lit?"#fff3c4":"#5a4a2a";c.beginPath();c.arc(x,y,9*u,0,TAU);c.fill();c.restore()});
    logo(c,A,W/2,H*.385,H*.28,{a:eo(seg(t,.28,.42)),s:.9+.1*eo(seg(t,.28,.5)),glow:18*u})}},
  particles:{n:"Gold particles",text:.5,draw(c,W,H,t,cfg,A){const u=H/1080,cx=W/2,cy=H*.4,R=H*.18;bg(c,W,H,cfg);const p=eio(seg(t,.04,.42)),r=rng(17),fade=1-seg(t,.42,.6);
    c.save();c.globalCompositeOperation="lighter";for(let i=0;i<420;i++){const sx=r()*W,sy=r()*H,a=r()*TAU,d=Math.sqrt(r())*R,tx=cx+Math.cos(a)*d,ty=cy+Math.sin(a)*d,sw=(r()-.5)*.6;
      const x=sx+(tx-sx)*p+Math.sin(p*Math.PI)*sw*200*u,y=sy+(ty-sy)*p,s=(2+r()*3)*u;c.globalAlpha=(.4+.6*r())*(fade*.9+.1);c.fillStyle=r()<.5?cfg.accent:"#fff4c2";c.beginPath();c.arc(x,y,s,0,TAU);c.fill()}c.restore();
    const fl=seg(t,.4,.44)*(1-seg(t,.44,.55));if(fl>0){const g=c.createRadialGradient(cx,cy,0,cx,cy,H*.5);g.addColorStop(0,`rgba(255,250,230,${fl})`);g.addColorStop(1,"rgba(255,250,230,0)");c.fillStyle=g;c.fillRect(0,0,W,H)}
    logo(c,A,cx,cy,H*.36,{a:eo(seg(t,.4,.5)),s:.96+.04*eo(seg(t,.4,.6)),glow:26*u});sparkles(c,W,H,t,18,cfg.accent,.5)}},
  filmstrip:{n:"Film strip",text:.5,draw(c,W,H,t,cfg,A){const u=H/1080,sh=H*.46,y0=H*.4-sh/2,fw=sh*1.25,p=eo(seg(t,0,.42)),off=(1-p)*fw*9,cx=W/2,fade=1-seg(t,.5,.66);bg(c,W,H,cfg);
    if(fade>0){c.save();c.globalAlpha=fade;c.fillStyle="#0b0b0e";c.fillRect(0,y0,W,sh);const hole=18*u;
      for(let k=-6;k<=6;k++){const x=cx-fw/2+k*fw-off%fw-Math.floor(off/fw)*0;const g=c.createLinearGradient(x,y0,x+fw,y0+sh);g.addColorStop(0,"rgba(255,190,90,.25)");g.addColorStop(1,"rgba(90,160,255,.22)");c.fillStyle=g;c.fillRect(x+14*u,y0+44*u,fw-28*u,sh-88*u);
        c.fillStyle="rgba(250,246,236,.85)";for(let j=0;j<5;j++){const hx=x+j*fw/5+fw/10-hole/2;c.fillRect(hx,y0+12*u,hole,hole*.75);c.fillRect(hx,y0+sh-12*u-hole*.75,hole,hole*.75)}}c.restore()}
    const blur=(1-p);c.save();if(blur>.02)c.filter=`blur(${blur*14*u}px)`;logo(c,A,cx-(off%fw>fw/2?off%fw-fw:off%fw),H*.4,H*.32*(1+.12*seg(t,.45,.7)),{glow:20*u*(1-blur)});c.restore()}},
  neon:{n:"Neon sign",text:.45,draw(c,W,H,t,cfg,A){const u=H/1080,f=Math.floor(t*60),r=rng(50+f);c.fillStyle="#08060f";c.fillRect(0,0,W,H);
    c.strokeStyle="rgba(255,255,255,.035)";c.lineWidth=2*u;for(let y=0;y<H;y+=44*u){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();for(let x=((y/(44*u))%2)*60*u;x<W;x+=120*u){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+44*u);c.stroke()}}
    const on=t<.08?0:t<.4?(r()<.25+t*1.8?1:.15):1,col=cfg.accent==="#ffd84a"?"#ff3fa4":cfg.accent;const g=c.createRadialGradient(W/2,H*.4,0,W/2,H*.4,H*.6);g.addColorStop(0,rgba(col,.22*on));g.addColorStop(1,rgba(col,0));c.fillStyle=g;c.fillRect(0,0,W,H);
    logo(c,A,W/2,H*.4,H*.36,{a:.15+.85*on,glow:(30+20*Math.sin(t*20))*u*on,glowCol:col});
    if(on>.5){c.save();c.strokeStyle=col;c.lineWidth=6*u;c.shadowColor=col;c.shadowBlur=30*u;c.beginPath();c.roundRect?c.roundRect(W*.18,H*.08,W*.64,H*.84,40*u):c.rect(W*.18,H*.08,W*.64,H*.84);c.stroke();c.restore()}}}
};

/* optional seasonal extras over the top */
const EXTRAS={none:"None",sparkle:"Gold sparkle",confetti:"Confetti",snow:"Snowfall",bats:"Bats (Halloween)",hearts:"Hearts",fireworks:"Fireworks"};
function extra(c,W,H,t,k,cfg){const u=H/1080;if(!k||k==="none")return;c.save();
  if(k==="sparkle")sparkles(c,W,H,t,40,cfg.accent,0);
  else if(k==="confetti"){const r=rng(21),cols=["#ffd84a","#f39a2b","#e2452e","#ffffff","#1fa0de"];for(let i=0;i<110;i++){const x0=r()*W,y0=r(),k2=r()<.6?1:2,ph=r(),col=cols[i%5],w=(14+r()*10)*u,h=(7+r()*5)*u,y=((y0+t*k2)%1)*(H+80*u)-40*u,x=x0+Math.sin(TAU*(t*k2+ph))*40*u;c.save();c.translate(x,y);c.rotate(TAU*(t*k2+ph));c.scale(1,Math.cos(TAU*(t*k2*2+ph)));c.fillStyle=col;c.fillRect(-w/2,-h/2,w,h);c.restore()}}
  else if(k==="snow"){const r=rng(31);c.fillStyle="#fff";for(let i=0;i<180;i++){const x0=r()*W,y0=r(),rad=(2+r()*5)*u,ph=r(),y=((y0+t)%1)*(H+20*u)-10*u,x=x0+Math.sin(TAU*(t+ph))*24*u;c.globalAlpha=.45+r()*.5;c.beginPath();c.arc(x,y,rad,0,TAU);c.fill()}}
  else if(k==="bats"){const r=rng(61);c.fillStyle="#0d0714";for(let i=0;i<9;i++){const y0=r()*.6+.05,ph=r(),s=(26+r()*34)*u,d=r()<.5?1:-1,p=(t+ph)%1,x=d>0?-80*u+p*(W+160*u):W+80*u-p*(W+160*u),y=y0*H+Math.sin(TAU*(t*2+ph))*40*u,f=Math.sin(TAU*(t*14+ph*3)),wy=-s*.7*f;
    c.save();c.translate(x,y);c.scale(d,1);c.beginPath();c.moveTo(0,-s*.12);c.quadraticCurveTo(-s*.45,-s*.35+wy*.6,-s*1.25,wy);c.quadraticCurveTo(-s*.8,s*.2,-s*.4,s*.1);c.quadraticCurveTo(-s*.2,s*.3,0,s*.18);c.quadraticCurveTo(s*.2,s*.3,s*.4,s*.1);c.quadraticCurveTo(s*.8,s*.2,s*1.25,wy);c.quadraticCurveTo(s*.45,-s*.35+wy*.6,0,-s*.12);c.fill();c.beginPath();c.ellipse(0,0,s*.16,s*.26,0,0,TAU);c.fill();c.restore()}}
  else if(k==="hearts"){const r=rng(81),cols=["#ff4d6d","#ff8fab","#ffffff"];for(let i=0;i<30;i++){const x0=r()*W,y0=r(),s=(14+r()*24)*u,ph=r(),y=(1-(y0+t)%1)*(H+80*u)-40*u,x=x0+Math.sin(TAU*(t+ph))*30*u;c.save();c.translate(x,y);c.globalAlpha=.85;c.fillStyle=cols[i%3];c.beginPath();c.moveTo(0,s*.9);c.bezierCurveTo(-s*1.4,-s*.1,-s*.7,-s*1.25,0,-s*.45);c.bezierCurveTo(s*.7,-s*1.25,s*1.4,-s*.1,0,s*.9);c.fill();c.restore()}}
  else if(k==="fireworks"){const r=rng(111),cols=["#ffd84a","#ff5a4f","#4fb6ff","#ff8be0","#ffffff"];c.globalCompositeOperation="lighter";for(let i=0;i<6;i++){const cx=(.1+r()*.8)*W,cy=(.08+r()*.4)*H,ph=r(),col=cols[i%5],R=(150+r()*160)*u,p=(t*2+ph)%1;if(p>.55)continue;const q=p/.55,e=eo(q),al=Math.pow(1-q,1.4);
    for(let j=0;j<32;j++){const a=j/32*TAU,d=R*e,x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d+q*q*60*u;c.strokeStyle=col;c.globalAlpha=al*.8;c.lineWidth=3*u;c.beginPath();c.moveTo(cx+Math.cos(a)*d*.72,cy+Math.sin(a)*d*.72+q*q*40*u);c.lineTo(x,y);c.stroke()}}}
  c.restore()}

function draw(c,W,H,t,cfg,A){cfg={...DEFAULT,...cfg};const st=STYLES[cfg.style]||STYLES.spotlight;c.save();
  st.draw(c,W,H,t,cfg,A);extra(c,W,H,t,cfg.extra,cfg);
  words(c,W,H,cfg,seg(t,st.text,st.text+.3));
  const fin=seg(t,0,.035),fout=seg(t,.93,1);if(fin<1||fout>0){c.fillStyle=`rgba(0,0,0,${Math.max(1-fin,fout)})`;c.fillRect(0,0,W,H)}c.restore()}
function loadAssets(base){return new Promise(r=>{const im=new Image();im.onload=()=>r({logo:im});im.onerror=()=>r({logo:null});im.src=(base||"")+"imc-logo.png"})}
/* compact encoding for the TV link (foyer TVs can't see the hub's saved settings) */
const KEYS=["style","kicker","title","msg","theme","accent","extra","dur"];
function encode(list){const a=list.map(x=>KEYS.map(k=>x[k]??DEFAULT[k]));const s=JSON.stringify(a);return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function decode(s){try{s=s.replace(/-/g,"+").replace(/_/g,"/");const a=JSON.parse(decodeURIComponent(escape(atob(s))));return a.map(v=>{const o={...DEFAULT};KEYS.forEach((k,i)=>{if(v[i]!=null)o[k]=v[i]});o.dur=Math.max(4,Math.min(20,+o.dur||8));if(!STYLES[o.style])o.style="spotlight";return o})}catch(e){return[]}}
window.IMCIdent={STYLES,THEMES,EXTRAS,DEFAULT,draw,loadAssets,encode,decode};
})();
