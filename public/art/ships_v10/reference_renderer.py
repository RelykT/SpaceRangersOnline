"""Reference renderer for the Кромка v10 ship release. Reads ONLY manifest.json + release files.
Use it as an executable spec for the in-game renderer.  python3 reference_renderer.py <ship_id> [t] [out.png]"""
import json, math, sys, numpy as np
from PIL import Image, ImageFilter
M=json.load(open('manifest.json')); SH={s['id']:s for s in M['ships']}
def flicker(t,i=0.7): return 0.5+0.5*math.sin(2*math.pi*7*t+i)*math.sin(2*math.pi*3*t+2*i)
def wave(m,t):
    tt=2*math.pi*m.get('cycles_per_loop',1)*t+m.get('phase_rad',0)
    if m['type']=='sin': return m['amp_deg']*math.sin(tt),0,0
    if m['type']=='open': return m['amp_deg']*(0.5-0.5*math.cos(tt)),0,0
    if m['type']=='bob': return m['amp_deg']*math.sin(tt), m['dx']*math.cos(tt), m['dy']*math.sin(tt)
def rot_paste(dst,img,pivot,world,angle_cw):
    W,H=img.size; r=img.rotate(-angle_cw,resample=Image.BICUBIC,expand=True)
    vx,vy=pivot[0]-W/2,pivot[1]-H/2; A=math.radians(angle_cw)
    rx=vx*math.cos(A)-vy*math.sin(A); ry=vx*math.sin(A)+vy*math.cos(A)     # canvas rotation (clockwise, y down)
    dst.alpha_composite(r,(int(round(world[0]-(r.width/2+rx))),int(round(world[1]-(r.height/2+ry)))))
def rotv(x,y,a):
    A=math.radians(a); return x*math.cos(A)-y*math.sin(A), x*math.sin(A)+y*math.cos(A)
def render(sid,t=0.25,size=512,bg=(5,11,27),turret_aim=None):
    s=SH[sid]; S=size; P=128  # padding so moving parts are not clipped
    f=Image.new('RGBA',(S+2*P,S+2*P),bg+(255,)); k=S/512
    xf={}  # part name -> (anchor_px, angle_cw, offset_px)
    def part_state(p):
        a,dx,dy=wave(p['motion'],t) if 'motion' in p else (0,0,0)
        return p['rest_angle_deg']+a,(dx*S,dy*S)
    def draw_parts(layer):
        for p in s['rig']['parts']:
            if p['layer']!=layer: continue
            ax,ay=p['anchor_uv'][0]*S+P,p['anchor_uv'][1]*S+P
            if p['kind']=='chain':
                ang=p['rest_angle_deg']; x,y=ax,ay
                for sg in p['segments']:
                    ang+=wave(sg['motion'],t)[0]; im=Image.open(sg['file']).convert('RGBA')
                    if k!=1: im=im.resize((max(1,int(im.width*k)),max(1,int(im.height*k))),Image.LANCZOS)
                    rot_paste(f,im,[q*k for q in sg['pivot_px']],(x,y),ang)
                    dx,dy=rotv(0,sg['length']*S,ang); x+=dx; y+=dy
                continue
            ang,(ox,oy)=part_state(p); xf[p['name']]=((ax,ay),ang,(ox,oy))
            im=Image.open(p['file']).convert('RGBA')
            if k!=1: im=im.resize((max(1,int(im.width*k)),max(1,int(im.height*k))),Image.LANCZOS)
            rot_paste(f,im,[q*k for q in p['pivot_px']],(ax+ox,ay+oy),ang)
    for p in s['rig']['parts']:
        if p['kind']=='sprite': xf[p['name']]=((p['anchor_uv'][0]*S+P,p['anchor_uv'][1]*S+P),)+part_state(p)
    draw_parts('under')
    base=Image.open(s['base_512']).convert('RGBA').resize((S,S),Image.LANCZOS); f.alpha_composite(base,(P,P))
    # turrets (hull-parented now; part-parented after their part, drawn together here for brevity)
    halo=s.get('turret_halo')
    over=[p for p in s['rig']['parts'] if p['layer']=='over']
    def draw_turret(sk):
        x,y=sk['u']*S+P,sk['v']*S+P; ang=sk['rest_angle_deg'] if turret_aim is None else turret_aim
        if sk['parent']!='hull':
            (ax,ay),pa,(ox,oy)=xf[sk['parent']]; dx,dy=rotv(x-ax,y-ay,pa); x,y=ax+ox+dx,ay+oy+dy; ang+=pa
        ts=M['turret_sets'][s['race']][sk['type']]; im=Image.open(ts['file_128']).convert('RGBA'); d=max(4,int(round(sk['turret_draw_size']*S)))
        im=im.resize((d,d),Image.LANCZOS); a=np.asarray(im).astype(np.float32); a[...,:3]=np.clip(a[...,:3]*sk['tone_gain'],0,255); im=Image.fromarray(a.astype(np.uint8))
        im=im.rotate(-ang,resample=Image.BICUBIC); al=im.split()[3]; kk=max(0.4,sk['radius']*1024/40)*k*2*0.5
        sh=Image.new('RGBA',im.size,(0,0,0,0)); sh.putalpha(al.point(lambda v:v*160//255).filter(ImageFilter.GaussianBlur(2.5*kk)))
        f.alpha_composite(sh,(int(x-d/2+2*kk),int(y-d/2+3*kk)))
        if halo:
            src=al.filter(ImageFilter.MaxFilter(max(3,int(halo.get('dilate_k',0)*kk)|1))) if halo['kind']=='outline' else al
            h=Image.new('RGBA',im.size,tuple(halo['color'])+(0,)); h.putalpha(src.point(lambda v:int(v*halo['alpha'])).filter(ImageFilter.GaussianBlur(max(0.8,halo['blur_k']*kk))))
            f.alpha_composite(h,(int(x-d/2),int(y-d/2)))
        f.alpha_composite(im,(int(round(x-d/2)),int(round(y-d/2))))
    for sk in sorted(s['sockets'],key=lambda q:q['draw_index']):
        if sk['parent']=='hull': draw_turret(sk)
    draw_parts('over')
    for sk in sorted(s['sockets'],key=lambda q:q['draw_index']):
        if sk['parent']!='hull': draw_turret(sk)
    # glow (additive)
    g=s['rig']['glow']; expr=g['alpha']; amp=eval(expr,{'sin':math.sin,'pi':math.pi,'t':t,'flicker':flicker})
    gm=np.asarray(Image.open(s['glow_512']).convert('RGBA').resize((S,S),Image.LANCZOS)).astype(np.float32)[...,3]/255
    arr=np.asarray(f).astype(np.float32); arr[P:P+S,P:P+S,:3]+=gm[...,None]*np.array(g['color'])*amp
    if 'core' in s['rig']:
        c=s['rig']['core']; yy,xx=np.mgrid[0:S,0:S]; d=np.hypot(xx-c['u']*S,yy-c['v']*S)
        ca=eval(c['alpha'],{'sin':math.sin,'pi':math.pi,'t':t}); core=np.exp(-(np.maximum(d-c['radius']*S*0.3,0)/(c['blur']*S+1e-6))**2)
        arr[P:P+S,P:P+S,:3]+=core[...,None]*np.array(c['color'])*ca*0.8
    out=Image.fromarray(np.clip(arr,0,255).astype(np.uint8))
    return out.crop((P,P,P+S,P+S))
if __name__=='__main__':
    sid=sys.argv[1]; t=float(sys.argv[2]) if len(sys.argv)>2 else 0.25
    render(sid,t).convert('RGB').save(sys.argv[3] if len(sys.argv)>3 else f'{sid}_render.png')
