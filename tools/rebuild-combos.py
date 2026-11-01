"""One-off: rebuild sharp Medium / Large / Share combo cut-outs from IMC's large ticket-bundle photos.

  OUTDIR=/tmp/work python tools/rebuild-combos.py path/to/isnet-general-use.onnx

IMC's own combo photos are only 160px. Their bundle photos (data/products/t1mcb.jpg: popcorn, a Coca-Cola Zero Sugar and a
gold ticket; t1scb.jpg: popcorn, two drinks and two tickets) are sharp, but the tickets hide the lower-right corner of the
cups. This takes the tickets off, rebuilds each hidden corner from the same cup (plain body from a clean band higher up,
following the taper; the bottom rim from the visible part, or from the identical neighbouring cup), puts back the real
ZERO SUGAR / NO CALORIES lettering from whichever photo shows it whole, then cuts out with tools/cutout.py (the photos'
smeared see-through background and black block are cleared first, along the box edges measured on these two photos).
Medium: the hidden lower part of its cup is taken from the two-drink photo's left cup (the same cup, fully visible,
scaled to match) and the right-hand strip from the same cup's own shading. The results were checked by eye and saved as data/products/cut/combotest.png, lccc.png and scon.png (see handmade.json).
Needs numpy, scipy, pillow and onnxruntime."""
import os, sys
WORK = os.environ.get("OUTDIR", "."); MODEL = sys.argv[1] if len(sys.argv) > 1 else "isnet-general-use.onnx"

# ---------- rebuild (share) ----------
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from scipy.spatial import ConvexHull
S=WORK
def load(n):return np.asarray(Image.open(f"data/products/{n}.jpg").convert("RGB")).astype(float)
M=load("t1mcb");SC=load("t1scb")
def cls(a):
    R,G,B=a[...,0],a[...,1],a[...,2]
    red=(R>150)&(G<110)&(B<110)&(R-G>70)
    gold=(R>120)&(G>85)&(B<120)&(R-B>45)&(G-B>25)
    wh=(R>190)&(G>190)&(B>190)
    return red,gold,wh
def ticket(a,xmin,ymin,grow=4):
    red,gold,_=cls(a);H,W=red.shape;yy,xx=np.mgrid[0:H,0:W]
    g=nd.binary_closing(gold&(xx>xmin)&(yy>ymin),iterations=2)
    lab,n=nd.label(g);out=Image.new("L",(W,H),0);d=ImageDraw.Draw(out)
    for i in range(1,n+1):
        ys,xs=np.where(lab==i)
        if len(ys)<40: continue
        pts=np.c_[xs,ys];h=ConvexHull(pts);d.polygon([tuple(map(float,pts[j])) for j in h.vertices],fill=255)
    return nd.binary_dilation(np.asarray(out)>0,iterations=grow)
def edges(a,rows,x0,x1,seed):
    red,_,_=cls(a);L=[];R=[]
    for y in rows:
        if not red[y,seed]: continue
        l=seed
        while l>x0 and red[y,l-1]: l-=1
        r=seed
        while r<x1 and red[y,r+1]: r+=1
        L.append((y,l));R.append((y,r))
    L=np.array(L);R=np.array(R);return np.polyfit(L[:,0],L[:,1],1),np.polyfit(R[:,0],R[:,1],1)
def settle(a,f,rows):
    """keep the edge's slope, move it to where the edge really is in the last clean rows (red, then dark, scanning out from the line)"""
    red,_,_=cls(a);off=[]
    for y in rows:
        x=int(round(np.polyval(f,y)))-6
        while x<a.shape[1]-1 and red[y,x+1]: x+=1
        off.append(x+0.5-np.polyval(f,y))
    return np.array([f[0],f[1]+np.median(off)])
def rebuild(a,tk,fl,fr,band,ybot_guess,bot=None,rimsrc=None,band2=None):
    """fill the ticket-covered part of one cup: body from a clean band higher up (following the taper), rim from the visible bottom"""
    out=a.copy();H,W,_=a.shape;_,_,wh=cls(a)
    # the ticket's dark outline and shadow inside the cup's lower part count as covered too
    yy,xx=np.mgrid[0:H,0:W];notred=~cls(a)[0];dark=(a.max(-1)<120)|notred|(a.sum(-1)<240);near=nd.binary_dilation(tk,iterations=10)
    _,gold,_=cls(a)
    edge=(xx>=np.polyval(fr,yy)-14)   # only near the cup's right edge, where the ticket's outline is (the lettering is further in)
    tk=tk|((dark|gold)&near&edge&(xx<=np.polyval(fr,yy)+2)&(yy>band[0]))
    Lf=lambda y:np.polyval(fl,y);Rf=lambda y:np.polyval(fr,y)
    # bottom of the cup (last white rim row) for visible columns
    bots={}
    for x in range(int(Lf(ybot_guess))+3,int(Rf(ybot_guess))-2):
        col=wh[ybot_guess-12:ybot_guess+12,x];cov=tk[ybot_guess-12:ybot_guess+12,x]
        if cov.any(): continue
        ys=np.where(col)[0]
        if len(ys): bots[x]=ybot_guess-12+ys.max()
    xs=np.array(sorted(bots));ys=np.array([bots[x] for x in xs])
    ax=(Lf(ybot_guess)+Rf(ybot_guess))/2
    if bot is not None: c,src_ax,sdx,sdy=bot;c=np.array([c[0],c[1]+sdy]);vis=[];   # the bottom curve of an identical cup, moved
    else: c=np.polyfit((xs-ax)**2,ys,1)                    # symmetric bottom curve
    yb=lambda x:np.polyval(c,(x-ax)**2)
    if bot is None: vis=[x for x in xs]
    else: vis=[int(v+sdx) for v in bot[4]] if len(bot)>4 else []
    for y,x in zip(*np.where(tk)):
        Lx,Rx=Lf(y),Rf(y)
        if x<Lx-0.5: continue
        if x>Rx+1.5 or y>yb(x)+0.5: out[y,x]=a[5,W-5]*0+np.array([0,0,0.]);continue
        d=yb(x)-y
        if d<7 and rimsrc:
            sy,sx=rimsrc(y,x)
            if 0<=sx<W and not tk[sy,sx]: out[y,x]=a[sy,sx]
        elif d<7:                                          # rim and the shading just above it: from the nearest visible column at the same height above the bottom
            xm=2*ax-x;cand=[xm]+sorted(vis,key=lambda v:abs(v-xm))
            for xv in cand:
                xv=int(round(xv))
                yv=int(round(yb(xv)-d))
                if 0<=xv<W and not tk[yv,xv] and Lf(yv)<=xv<=Rf(yv): out[y,x]=a[yv,xv];break
        else:                                            # body: same place across the cup, a row from the clean band (or the spare band if the ticket reaches it)
            u=(x-Lx)/(Rx-Lx)
            for bd in [band]+([band2] if band2 else []):
                ys_=bd[0]+(y-bd[0])%(bd[1]-bd[0]);xs_=Lf(ys_)+u*(Rf(ys_)-Lf(ys_))
                x0=int(np.floor(xs_));f=xs_-x0;px=a[ys_,x0]*(1-f)+a[ys_,min(W-1,x0+1)]*f
                if not (tk[ys_,x0] or (px[1]>110 and px[0]>120 and px[2]<120)): break
            out[y,x]=px
    # nothing but background to the right of the cup in the ticket's rows
    for y in range(band[0]+8,min(H,int(ybot_guess)+20)):
        out[y,int(np.ceil(Rf(y)+1.5))+1:]=0
    return out
def repaint(orig,dst,y0,x0,h,w,fl,fr,band,band2=None):
    """plain cup (no lettering) over a small box, from the clean band, following the taper"""
    for y in range(y0,y0+h):
        for x in range(x0,x0+w):
            Lx,Rx=np.polyval(fl,y),np.polyval(fr,y);u=(x-Lx)/(Rx-Lx);ys_=band[0]+(y-band[0])%(band[1]-band[0]);xs_=np.polyval(fl,ys_)+u*(np.polyval(fr,ys_)-np.polyval(fl,ys_))
            xi=int(np.floor(xs_));f=xs_-xi;px=orig[ys_,xi]*(1-f)+orig[ys_,xi+1]*f
            if px[1]>110 and px[0]>120 and px[2]<120 and band2:
                ys_=band2[0]+(y-band2[0])%(band2[1]-band2[0]);xs_=np.polyval(fl,ys_)+u*(np.polyval(fr,ys_)-np.polyval(fl,ys_));xi=int(np.floor(xs_));f=xs_-xi;px=orig[ys_,xi]*(1-f)+orig[ys_,xi+1]*f
            dst[y,x]=px
def paste(dst,src,y,x,feather=2):
    """put only the lettering on: each pixel by how much darker it is than the cup there"""
    h,w,_=src.shape;reg=dst[y:y+h,x:x+w];al=np.clip((reg.mean(-1)-src.mean(-1)-6)/45,0,1)[...,None]
    dst[y:y+h,x:x+w]=reg*(1-al)+src*al;return
    h,w,_=src.shape;al=np.ones((h,w))
    for i in range(feather):
        f=(i+1)/(feather+1);al[i,:]=np.minimum(al[i,:],f);al[-1-i,:]=np.minimum(al[-1-i,:],f);al[:,i]=np.minimum(al[:,i],f);al[:,-1-i]=np.minimum(al[:,-1-i],f)
    dst[y:y+h,x:x+w]=dst[y:y+h,x:x+w]*(1-al[...,None])+src*al[...,None]
def find(img,tpl,y0,y1,x0,x1):
    best=None;h,w,_=tpl.shape
    for y in range(y0,y1):
        for x in range(x0,x1):
            e=np.abs(img[y:y+h,x:x+w]-tpl).mean()
            if best is None or e<best[0]:best=(e,y,x)
    return best
# MEDIUM (t1mcb)
tk=ticket(M,295,290);fl,fr=edges(M,range(200,335),200,450,323);fr=settle(M,fr,range(326,342));print("medium R",np.polyval(fr,[330,350,380]))
med=rebuild(M,tk,fl,fr,(305,336),398)
band=SC[329:341,228:276];bI=Image.fromarray(band.astype("uint8"));b2=np.asarray(bI.resize((round(bI.width*1.1),round(bI.height*1.1)),Image.LANCZOS)).astype(float)
e,y,x=find(M,b2[:,:22],350,372,280,320);repaint(M,med,y-1,x-2,b2.shape[0]+2,b2.shape[1]+4,fl,fr,(305,336));paste(med,b2,y,x)
# anything else of the tickets (outside the cup) goes to the background
med[tk&~(np.abs(med-M).sum(-1)>0)]=0
_,goldM,_=cls(M);yy,xx=np.mgrid[0:M.shape[0],0:M.shape[1]]
stray=nd.binary_dilation(goldM&(xx>np.polyval(fr,yy)+2)&(yy>280),iterations=4)&(xx>np.polyval(fr,yy)+1);med[stray]=0
Image.fromarray(med.clip(0,255).astype("uint8")).save(S+"/med3.png")
# SHARE (t1scb): right cup
pt=SC[230:300,205:265];best=None
for dy in range(0,25):
    for dx in range(70,100):
        e=np.abs(SC[230+dy:300+dy,205+dx:265+dx]-pt).mean()
        if best is None or e<best[0]:best=(e,dx,dy)
_,dx,dy=best
tk2=ticket(SC,285,255,grow=7);fl2,_=edges(SC,range(205,300),280,440,340)
# right edge from the rows with no lettering at the edge (above the logo, and between the logo and the ticket)
_red=cls(SC)[0];pts=[(y,np.where(_red[y,300:430])[0].max()+300.5) for y in list(range(198,214))+list(range(282,304))]
fr2=np.polyfit([p[0] for p in pts],[p[1] for p in pts],1);print("share R",np.polyval(fr2,[300,310,330]))
_,_,whS=cls(SC);flL,_=edges(SC,range(205,300),150,300,240);axL=np.polyval(fr2,369+dy)-dx;axL=(np.polyval(flL,369)+axL)/2
fl2=np.array([flL[0],flL[1]-flL[0]*dy+dx])   # the right cup's left side = the left cup's, moved
bx=[];by=[]
for x in range(int(np.polyval(flL,369))+3,int(axL)+12):
    ys=np.where(whS[357:381,x])[0]
    if len(ys): bx.append(x);by.append(357+ys.max())
bx=np.array(bx);by=np.array(by);cL=np.polyfit((bx-axL)**2,by,1);print("left cup bottom",cL,axL)
def rim_from_left(y,x):
    sx,sy=x-dx,y-dy
    if sx>=279: sx=int(round(2*axL-sx))     # the left cup's own right end is behind the right cup: use its mirror image
    return sy,sx
sh=rebuild(SC,tk2,fl2,fr2,(299,320),369+dy,band2=(286,299),bot=(cL,axL,dx,dy),rimsrc=rim_from_left)
zs=M[338:352,286:359];zI=Image.fromarray(zs.astype("uint8"));z2=np.asarray(zI.resize((round(zI.width/1.1),round(zI.height/1.1)),Image.LANCZOS)).astype(float)
e,y,x=find(SC,z2[:,:24],305,335,215,260)
B2=(299,320)
repaint(SC,sh,y+dy-1,x+dx-2,z2.shape[0]+2,z2.shape[1]+4,fl2,fr2,B2,(286,299));paste(sh,z2,y+dy,x+dx)
repaint(SC,sh,329+dy-1,228+dx-2,band.shape[0]+2,band.shape[1]+4,fl2,fr2,B2,(286,299));paste(sh,band,329+dy,228+dx)
sh[tk2&~(np.abs(sh-SC).sum(-1)>0)]=0
# the right cup's bottom: its own bottom-left is clean, the cup is symmetric, so mirror it onto the bottom-right
base=sh.copy()
for y in range(340,SC.shape[0]):
    l,r=np.polyval(fl2,y),np.polyval(fr2,y);ax=(l+r)/2
    for x in range(int(ax)+1,int(r)+4):
        xm=2*ax-x;x0=int(np.floor(xm));f=xm-x0
        if x0<int(l)-3: continue
        yb=np.polyval(cL,(xm-dx-axL)**2)+dy     # bottom of the cup at the mirror column (the left cup's bottom, moved)
        if y<yb-9: continue
        w=float(np.clip((y-(yb-9))/3.0,0,1))
        sh[y,x]=sh[y,x]*(1-w)+(base[y,x0]*(1-f)+base[y,x0+1]*f)*w
_,goldS,_=cls(SC);yy,xx=np.mgrid[0:SC.shape[0],0:SC.shape[1]]
stray=nd.binary_dilation(goldS&(xx>285)&(yy>250),iterations=4)&((xx>np.polyval(fr2,yy)+1)|(yy>np.polyval(cL,(xx-axL-dx)**2)+dy+1));sh[stray]=0
Image.fromarray(sh.clip(0,255).astype("uint8")).save(S+"/share3.png")
print("ok",dx,dy)

# ---------- rebuild (medium) ----------
import numpy as np
from PIL import Image
from scipy import ndimage as nd
S=WORK
M=np.asarray(Image.open("data/products/t1mcb.jpg").convert("RGB")).astype(float)
SC=np.asarray(Image.open("data/products/t1scb.jpg").convert("RGB")).astype(float)
# exact match: t1mcb's ZERO SUGAR (scaled down 1.1) sits on the left cup in t1scb
zs=M[338:352,286:357];z2=np.asarray(Image.fromarray(zs.astype("uint8")).resize((round(71/1.1),round(14/1.1)),Image.LANCZOS)).astype(float)
best=None
for y in range(300,330):
    for x in range(205,240):
        e=np.abs(SC[y:y+z2.shape[0],x:x+z2.shape[1]]-z2).mean()
        if best is None or e<best[0]: best=(e,y,x)
_,zy,zx=best;print("ZERO SUGAR on the left cup at",zy,zx,round(best[0],1))
# the left cup's own edges in t1scb, row by row, below its logo
red=(SC[...,0]>150)&(SC[...,1]<120)
L={};R={}
for y in range(296,385):
    row=SC[y];xs=[x for x in range(200,300) if red[y,x]]
    if not xs: continue
    L[y]=min(xs)
    # right edge: the darkest column between the two cups (where the left cup ends)
    seg=row[278:302].sum(-1);R[y]=278+int(np.argmin(seg))
ys=sorted(R);fr=np.polyfit(ys,[R[y] for y in ys],1);ysl=[y for y in ys if y<360];fl=np.polyfit(ysl,[L[y] for y in ysl],1)
print("left cup L",np.polyval(fl,[300,370]),"R",np.polyval(fr,[300,370]))
# bottom of the left cup (last rim-white row) per column
wh=(SC.min(-1)>200)
bot={x:max([y for y in range(330,395) if wh[y,x]] or [0]) for x in range(int(np.polyval(fl,370))+2,int(np.polyval(fr,370))-1)}
bx=np.array([x for x in bot if bot[x]>0]);by=np.array([bot[x] for x in bx]);cb=np.polyfit(bx,by,2);print("bottom",np.polyval(cb,[bx.min(),bx.mean(),bx.max()]))
def samp(a,x,y):
    x0=int(np.floor(x));y0=int(np.floor(y));fx=x-x0;fy=y-y0
    return a[y0,x0]*(1-fx)*(1-fy)+a[y0,x0+1]*fx*(1-fy)+a[y0+1,x0]*(1-fx)*fy+a[y0+1,x0+1]*fx*fy
out=M.copy();Y0=354   # below ZERO SUGAR in t1mcb: keep everything above
for y in range(Y0-4,M.shape[0]):
    for x in range(230,470):
        sx=zx+(x-286)/1.1;sy=zy+(y-338)/1.1
        if sy>=SC.shape[0]-2: continue
        l,r=np.polyval(fl,sy),np.polyval(fr,sy)
        if sx<l-0.5:            # left of the cup: the popcorn box (or background) stays as it is
            continue
        if sx>r-0.5 or sy>np.polyval(cb,sx)+1.5: px=np.array([0,0,0.])   # right of / below the cup: background
        else: px=samp(SC,sx,sy)
        w=1.0 if y>=Y0 else (y-(Y0-4))/4.0   # blend into the original over 4 rows
        out[y,x]=out[y,x]*(1-w)+px*w
# the ticket above the seam at the right edge of the cup
tk=(M[...,0]>120)&(M[...,1]>85)&(M[...,2]<120)&(M[...,0]-M[...,2]>45)
yy,xx=np.mgrid[0:M.shape[0],0:M.shape[1]]
isred=(M[...,0]>120)&(M[...,1]<90)
out[nd.binary_dilation(tk&(yy>300)&(xx>330),iterations=4)&(yy>300)&(xx>360)&(yy<Y0)&~isred]=0
# the cup's true edges in t1mcb, from clean rows above the ticket, carried down
redM=(M[...,0]>150)&(M[...,1]<110)
def edge_pts(rows,side):
    pts=[]
    for y in rows:
        xs=np.where(redM[y,250:420])[0]+250
        if len(xs)<30: continue
        pts.append((y,(xs.min()-0.5) if side=="L" else (xs.max()+0.5)))
    return np.polyfit([p[0] for p in pts],[p[1] for p in pts],1)
# right edge: clean rows between the swoosh and the ticket; left edge: where the cup is in front of the box
frT=edge_pts(range(300,338),"R");flT=np.polyval(fl,zy+(np.arange(354,400)-338)/1.1)*1.1  # unused
print("t1mcb R edge",np.polyval(frT,[300,340,390]))
# the transplanted section's right edge in t1mcb coordinates
srcR=lambda y:286+(np.polyval(fr,zy+(y-338)/1.1)-zx)*1.1
srcL=lambda y:286+(np.polyval(fl,zy+(y-338)/1.1)-zx)*1.1
base=out.copy()
for y in range(336,M.shape[0]):
    rT=np.polyval(frT,y);lT=srcL(y);ax=(lT+rT)/2
    start=(srcR(y)-16) if y>=Y0 else 361.0            # below the seam: short of the neighbouring cup's shadow; above it: just past ZERO SUGAR
    for x in range(int(np.floor(start))-3,int(np.ceil(rT))+3):
        xm=2*ax-x
        # where the bottom of the cup is at the mirror column (the cup is symmetric there)
        sxm=zx+(xm-286)/1.1;ybot=338+(np.polyval(cb,sxm)-zy)*1.1
        if x>rT+0.5 or y>ybot+1.5: px=np.array([0,0,0.])
        elif y>ybot-7:                                 # the white rim: mirrored
            x0=int(np.floor(xm));f=xm-x0;px=base[y,x0]*(1-f)+base[y,x0+1]*f
        else:                                          # the body: same place across the cup, from clean rows above (right-hand shading)
            u=(x-lT)/(rT-lT);ys_=300+(y-300)%36;xs_=srcL(ys_)+u*(np.polyval(frT,ys_)-srcL(ys_))
            x0=int(np.floor(xs_));f=xs_-x0;px=M[ys_,x0]*(1-f)+M[ys_,x0+1]*f
        w=float(np.clip((x-(start-3))/9.0,0,1))          # blend in over 4 pixels across
        out[y,x]=out[y,x]*(1-w)+px*w
Image.fromarray(out.clip(0,255).astype("uint8")).save(S+"/med4.png")
print("ok")
im=Image.fromarray(out.clip(0,255).astype("uint8")).crop((240,170,430,430));im.resize((im.width*3,im.height*3),Image.LANCZOS).save(S+"/med4_view.png")

# ---------- cut out ----------
import sys,numpy as np
sys.argv=['cutout','--model',MODEL]
from PIL import Image
from scipy import ndimage as nd
src=open('tools/cutout.py').read();ns={}
exec(src.split("os.makedirs(OUT, exist_ok=True)")[0].replace('if not todo:\n    print("nothing to do"); sys.exit(0)',''),ns)
from PIL import ImageDraw, ImageFilter
# the popcorn box's left and bottom edges, measured on IMC's photos (just inside the dark outline): below/left of these is background
BOXBG={"combo-share":[(0,0),(37,0),(37,214),(42.5,214),(90,360),(141.5,405),(206,371),(207,500),(0,500)],
       "combo-medium":[(0,0),(79,0),(79,378),(133,378),(137.5,391.5),(197.5,443),(268,413),(269,520),(0,520)]}
def boxbg(a,name):
    m=Image.new("L",(a.shape[1],a.shape[0]),0);ImageDraw.Draw(m).polygon(BOXBG[name],fill=255);return np.asarray(m)>0
def directcut(path):
    """cut-out from the background worked out by whiten(): no guessing, so white cup rims on IMC's black block stay"""
    big=Image.open(path).convert("RGB");rgb=np.asarray(big).astype("float32")/255
    keep=nd.binary_opening(~BGMASK,iterations=2)                                          # thin slivers (streaks) go
    lab,n=nd.label(keep);sz=nd.sum(keep,lab,range(1,n+1));keep=lab==(np.argmax(sz)+1)    # the product: the one big piece
    keep=nd.binary_fill_holes(keep)
    # a smooth edge: work at 4x, blur, then back down (anti-aliased like a real cut-out), pulled in half a pixel so no dark fringe
    K=Image.fromarray((keep*255).astype("uint8")).resize((keep.shape[1]*4,keep.shape[0]*4),Image.BILINEAR).filter(ImageFilter.GaussianBlur(3))
    K=K.point(lambda v:255 if v>150 else 0).filter(ImageFilter.GaussianBlur(2)).resize((keep.shape[1],keep.shape[0]),Image.LANCZOS)
    al=np.asarray(K).astype("float32")/255
    return Image.fromarray((np.dstack([rgb,al])*255).round().astype("uint8"),"RGBA")
def mycut(path):
    """tools/cutout.py's cut, but cleaning the edge against the background colour at each pixel (white or grey)"""
    big=Image.open(path).convert("RGB");rgb=np.asarray(big).astype("float32")/255
    m=ns['mask'](big);alpha=np.clip((m-0.3)/0.45,0,1);alpha=alpha*alpha*(3-2*alpha)
    alpha=np.where(nd.binary_fill_holes(alpha>0.5),np.maximum(alpha,1.0),alpha)
    alpha=np.asarray(Image.fromarray((alpha*255).astype("uint8")).filter(ImageFilter.MinFilter(3))).astype("float32")/255
    Bc=BGCOL.astype("float32")/255;ae=np.maximum(alpha,1e-3)[...,None]
    rgb=np.where(alpha[...,None]>0.02,np.clip((rgb-(1-ae)*Bc)/ae,0,1),rgb)
    return Image.fromarray((np.dstack([rgb,alpha])*255).round().astype("uint8"),"RGBA")
def whiten(a,name=None):
    """IMC's big photos sit on white with a black block behind the products: make all of that background white"""
    mx=a.max(-1);mn=a.min(-1);bgish=(mx<=7)|(mn>236)
    # white background: white reached from the border through white; black block: black that touches that white background
    # (separately, so a white cup rim sitting on the black block isn't taken for background)
    redp=(a[...,0]>150)&(a[...,1]<110)&(a[...,2]<110)
    under=np.zeros_like(redp)
    for k in range(1,7): under[k:]|=redp[:-k]
    rim=(mn>200)&under          # white just below red: a cup's rim, never background
    lw,_=nd.label((mn>236)&~rim);ew=set(np.unique(np.r_[lw[0],lw[-1],lw[:,0],lw[:,-1]]))-{0};wbg=np.isin(lw,list(ew))
    lb,_=nd.label(mx<=7);eb=set(np.unique(lb[nd.binary_dilation(wbg,iterations=2)&(mx<=7)]))-{0};bbg=np.isin(lb,list(eb))
    bg=wbg|bbg;lab=np.where(bbg,1,0);edge={1}
    # IMC's flattened photos have smeared see-through pixels beside the box: runs of one identical, greyish colour
    # coming in from the background. Walk in from the left and from the bottom and take those runs off too.
    H,W,_=a.shape;ai=a.astype(int)
    def greyish(p):return (int(p.max())-int(p.min()))<150 and p[0]<215
    def walk(line,isbg):
        i=0;n=len(line)
        while i<n and isbg[i]: i+=1
        if i<n and greyish(line[i]):
            c=line[i].copy();j=i
            while j<n and (np.abs(line[j]-c).max()<=3): j+=1
            if j-i>=1 and j<n: return i,j
        return None
    for y in range(H):
        r=walk(ai[y],bg[y])
        if r: bg[y,r[0]:r[1]]=True
    # the same smear running down from the top, above the popcorn: a run of 4+ identical pixels straight after the background
    if name:
        for x in range(0,{"combo-share":200,"combo-medium":262}[name]):
            col=ai[:,x];y=0
            while y<H and bg[y,x]: y+=1
            j=y
            while j<H and np.abs(col[j]-col[y]).max()<=3: j+=1
            if j-y>=4 and y<H*0.5: bg[y:j,x]=True
    if name: bg|=boxbg(a,name)
    b=a.copy()
    # where the product's edge blended into IMC's black block, the edge pixels are darkened: give them the colour of the brightest product pixel next to them
    blk=bbg.copy()
    lum=b.sum(-1)
    for _ in range(2):
        ring=nd.binary_dilation(blk,iterations=1)&~blk&~bg
        best=np.full(lum.shape,-1.0);sy=np.zeros(lum.shape,int);sx=np.zeros(lum.shape,int);yy,xx=np.mgrid[0:b.shape[0],0:b.shape[1]]
        for dy in(-1,0,1):
            for dx in(-1,0,1):
                if dy==0 and dx==0: continue
                sh=np.roll(np.roll(lum,-dy,0),-dx,1);ok=np.roll(np.roll(~(blk|bg),-dy,0),-dx,1)&(sh>best)
                best=np.where(ok,sh,best);sy=np.where(ok,yy+dy,sy);sx=np.where(ok,xx+dx,sx)
        nb=b[sy.clip(0,b.shape[0]-1),sx.clip(0,b.shape[1]-1)]
        use=ring&(best>=0)&(nb.min(-1)<190)        # only next to coloured parts: white rims keep their dark edge, so they stay separate from the background
        ys,xs=np.where(use);b[ys,xs]=nb[ys,xs];lum=b.sum(-1);blk=blk|ring
    b[bg]=255
    global BGMASK;BGMASK=bg.copy()
    global BGCOL;BGCOL=np.full(b.shape,255.0)
    # soften the seam where black met the product
    return b
for name,f in [("combo-medium",WORK+"/med4.png"),("combo-share",WORK+"/share3.png")]:
    a=np.asarray(Image.open(f).convert("RGB")).astype(float)
    Image.fromarray(whiten(a,name).astype("uint8")).save(WORK+"/%s.png.jpg"%name,quality=97)
    out=directcut(WORK+"/%s.png.jpg"%name)
    a=np.asarray(out).copy();al=a[...,3]>150;lab,n=nd.label(nd.binary_opening(al,iterations=2));sz=nd.sum(al,lab,range(1,n+1))
    keep=np.isin(lab,[i+1 for i,v in enumerate(sz) if v>0.02*sz.max()])
    a[...,3]=np.where(nd.binary_dilation(keep,iterations=2),a[...,3],0)
    holes=nd.binary_fill_holes(a[...,3]>128)&(a[...,3]<=128)   # see-through gaps inside the product (pale lettering the model took for background)
    a[...,3]=np.where(holes,255,a[...,3])
    im2=Image.fromarray(a);bb=im2.getchannel("A").point(lambda v:255 if v>24 else 0).getbbox();im2=im2.crop((max(0,bb[0]-2),max(0,bb[1]-2),min(im2.width,bb[2]+2),min(im2.height,bb[3]+2)))
    im2.save(WORK+"/%s.png"%name);print(name,im2.size)
c=Image.new('RGB',(1400,620),(13,18,64))
for i,n in enumerate(['combo-medium','combo-share']):
  im=Image.open(WORK+"/%s.png"%n);im=im.resize((im.width*2,im.height*2),Image.LANCZOS);im.thumbnail((680,600));c.paste(im,(10+i*700,10),im)
c.save(WORK+'/combos_final.png')
