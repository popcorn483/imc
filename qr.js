/* Small QR code encoder (byte mode, error correction level M, versions 1–10: up to ~210 characters).
   IMCQR.make(text) returns {size, get(x,y)} where get is true for a dark module. No outside libraries. */
(function(){
const EC={1:[10,1,16,0,0],2:[16,1,28,0,0],3:[26,1,44,0,0],4:[18,2,32,0,0],5:[24,2,43,0,0],6:[16,4,27,0,0],7:[18,4,31,0,0],8:[22,2,38,2,39],9:[22,3,36,2,37],10:[26,4,43,1,44]};
const ALIGN={1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50]};
const EXP=new Array(512),LOG=new Array(256);(()=>{let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d}for(let i=255;i<512;i++)EXP[i]=EXP[i-255]})();
const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
function rsGen(n){let g=[1];for(let i=0;i<n;i++){const ng=new Array(g.length+1).fill(0);for(let j=0;j<g.length;j++){ng[j]^=g[j];ng[j+1]^=mul(g[j],EXP[i])}g=ng}return g}
function rsEc(data,n){const g=rsGen(n),r=data.concat(new Array(n).fill(0));for(let i=0;i<data.length;i++){const c=r[i];if(c)for(let j=0;j<g.length;j++)r[i+j]^=mul(g[j],c)}return r.slice(data.length)}
const utf8=s=>Array.from(new TextEncoder().encode(s));
function capacity(v){const e=EC[v];return e[1]*e[2]+e[3]*e[4]}
function make(text){const bytes=utf8(String(text));let v=1;for(;v<=10;v++){const cc=v<10?8:16;if(4+cc+bytes.length*8<=capacity(v)*8)break}if(v>10)throw new Error("Link too long for a QR code");
  const cc=v<10?8:16,bits=[];const put=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push((val>>>i)&1)};put(4,4);put(bytes.length,cc);bytes.forEach(b=>put(b,8));
  const cap=capacity(v)*8;for(let i=0;i<4&&bits.length<cap;i++)bits.push(0);while(bits.length%8)bits.push(0);
  const data=[];for(let i=0;i<bits.length;i+=8){let b=0;for(let j=0;j<8;j++)b=b<<1|bits[i+j];data.push(b)}for(let p=0;data.length<capacity(v);p++)data.push(p%2?0x11:0xEC);
  const [ecn,b1,d1,b2,d2]=EC[v],blocks=[],ecs=[];let k=0;for(let i=0;i<b1+b2;i++){const n=i<b1?d1:d2,blk=data.slice(k,k+n);k+=n;blocks.push(blk);ecs.push(rsEc(blk,ecn))}
  const out=[];const maxD=Math.max(d1,d2||0);for(let i=0;i<maxD;i++)blocks.forEach(b=>{if(i<b.length)out.push(b[i])});for(let i=0;i<ecn;i++)ecs.forEach(e=>out.push(e[i]));
  const size=17+4*v,M=[],F=[];for(let y=0;y<size;y++){M.push(new Array(size).fill(false));F.push(new Array(size).fill(false))}
  const set=(x,y,d)=>{if(x<0||y<0||x>=size||y>=size)return;M[y][x]=d;F[y][x]=true};
  const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,d!==2&&d!==4)}};
  finder(3,3);finder(size-4,3);finder(3,size-4);
  for(let i=0;i<size;i++){if(!F[6][i])set(i,6,i%2===0);if(!F[i][6])set(6,i,i%2===0)}
  const al=ALIGN[v],last=al.length-1;al.forEach((ay,i)=>al.forEach((ax,j)=>{if((i===0&&j===0)||(i===0&&j===last)||(i===last&&j===0))return;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(ax+dx,ay+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1)}))
  for(let i=0;i<9;i++){if(!F[8][i])F[8][i]=true;if(!F[i][8])F[i][8]=true}for(let i=0;i<8;i++){F[8][size-1-i]=true;F[size-1-i][8]=true}set(8,size-8,true);
  if(v>=7){for(let i=0;i<6;i++)for(let j=0;j<3;j++){F[i][size-11+j]=true;F[size-11+j][i]=true}}
  const allBits=[];out.forEach(b=>{for(let i=7;i>=0;i--)allBits.push((b>>i)&1)});
  let bi=0;for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){const x=right-j,up=((right+1)&2)===0,y=up?size-1-vert:vert;if(!F[y][x]){M[y][x]=bi<allBits.length?allBits[bi]===1:false;bi++}}}
  const MASKS=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(y/2)+Math.floor(x/3))%2===0,(x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
  const bch=(val,poly,bitsN)=>{const deg=Math.floor(Math.log2(poly));let r=val<<deg;while(Math.floor(Math.log2(r||1))>=deg&&r)r^=poly<<(Math.floor(Math.log2(r))-deg);return (val<<deg)|r};
  function withMask(m){const G=M.map(r=>r.slice());for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!F[y][x]&&MASKS[m](x,y))G[y][x]=!G[y][x];
    const fmt=bch((0<<3)|m,0x537)^0x5412;
    const B=i=>((fmt>>i)&1)===1,P=(x,y,b)=>{G[y][x]=b};
    for(let i=0;i<=5;i++)P(8,i,B(i));P(8,7,B(6));P(8,8,B(7));P(7,8,B(8));for(let i=9;i<15;i++)P(14-i,8,B(i));
    for(let i=0;i<8;i++)P(size-1-i,8,B(i));for(let i=8;i<15;i++)P(8,size-15+i,B(i));P(8,size-8,true);
    if(v>=7){const vb=bch(v,0x1f25);for(let i=0;i<18;i++){const bit=((vb>>i)&1)===1,a=Math.floor(i/3),b=size-11+i%3;G[b][a]=bit;G[a][b]=bit}}
    return G}
  function penalty(G){let p=0;for(let pass=0;pass<2;pass++)for(let i=0;i<size;i++){let run=1;for(let j=1;j<size;j++){const a=pass?G[j][i]:G[i][j],b=pass?G[j-1][i]:G[i][j-1];if(a===b){run++;if(run===5)p+=3;else if(run>5)p++}else run=1}}
    for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=G[y][x];if(c===G[y][x+1]&&c===G[y+1][x]&&c===G[y+1][x+1])p+=3}
    const pat=[true,false,true,true,true,false,true];for(let y=0;y<size;y++)for(let x=0;x<=size-7;x++){let h=true,vv=true;for(let k=0;k<7;k++){if(G[y][x+k]!==pat[k])h=false;if(G[x+k]&&G[x+k][y]!==pat[k])vv=false}if(h)p+=40;if(vv)p+=40}
    let dark=0;G.forEach(r=>r.forEach(c=>{if(c)dark++}));p+=Math.floor(Math.abs(dark*20/(size*size)-10))*10;return p}
  let best=null,bp=Infinity;for(let m=0;m<8;m++){const G=withMask(m),p=penalty(G);if(p<bp){bp=p;best=G}}
  return{size,version:v,get:(x,y)=>best[y][x]}}
window.IMCQR={make};
})();
