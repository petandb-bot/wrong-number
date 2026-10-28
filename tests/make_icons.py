from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'assets'
S=512
im=Image.new('RGB',(S,S),'#33103e');d=ImageDraw.Draw(im)
d.rounded_rectangle((14,14,498,498),radius=93,fill='#f83f98',outline='#ffbee5',width=16)
d.rounded_rectangle((40,43,472,468),radius=68,outline='#b92a78',width=8)
d.rounded_rectangle((58,68,455,236),radius=35,fill='#7046a2',outline='#30103f',width=12)
d.rounded_rectangle((75,82,438,218),radius=17,fill='#b9ec8d',outline='#2a4431',width=8)
# Deliberate game-watch 3 bunny silhouettes, pixel squares and expressive eyes
sprite=[
 '..##....##..',
 '..###..###..',
 '..###..###..',
 '...######...',
 '..########..',
 '.##########.',
 '.##########.',
 '.##########.',
 '..########..',
 '...######...',
 '...######...',
 '..########..',
 '..##....##..',
 '..##....##..',
]
for n in range(3):
 x0=100+n*106;y0=104+(n%2)*6;px=7
 for yy,line in enumerate(sprite):
  for xx,c in enumerate(line):
   if c=='#':d.rectangle((x0+xx*px,y0+yy*px,x0+xx*px+5,y0+yy*px+5),fill='#30513a')
 for eye in (3,8):
  ex=x0+eye*px;ey=y0+6*px
  d.rectangle((ex,ey,ex+6,ey+5),fill='#b9ec8d')
  d.point((ex+3,ey+2),fill='#30513a')
 d.rectangle((x0+5*px,y0+8*px,x0+7*px,y0+8*px+4),fill='#b9ec8d')
# Four by four uniform candy pads
fills=['#ffb9dc','#91f4cf','#fff07b','#8bdcff','#ffac6e','#d4a4ff','#ff8dd0','#79eebc']
for row in range(4):
 for col in range(4):
  x=68+col*97;y=254+row*46
  d.rounded_rectangle((x,y,x+82,y+39),radius=11,fill='#2f123e')
  d.rounded_rectangle((x+2,y+2,x+80,y+34),radius=10,fill=fills[(row*4+col)%8],outline='#7a3c68',width=2)
try:font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',24)
except:font=ImageFont.load_default()
d.text((78,447),'WRONG NUMBER',fill='#f5ff83',font=font,stroke_width=1,stroke_fill='#30123d')
for s in [180,192,512]:im.resize((s,s),Image.Resampling.LANCZOS).save(P/f'icon-{s}.png')
