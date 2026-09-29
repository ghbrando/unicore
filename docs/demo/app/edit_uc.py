"""Cut the provider and consumer recordings into one UniCore demo (MP4 + GIF)."""
import glob, json, subprocess, sys
from pathlib import Path

R = Path(sys.argv[1])
m = json.loads((R / "marks.json").read_text())
prov = glob.glob(str(R / "provider" / "*.webm"))[0]
cons = glob.glob(str(R / "consumer" / "*.webm"))[0]
P, C = m["provider"], m["consumer"]

FONT = "C\\:/Windows/Fonts/consola.ttf"
def label(text):
    return (f"drawbox=x=0:y=ih-64:w=iw:h=64:color=black@0.72:t=fill,"
            f"drawtext=fontfile='{FONT}':text='{text}':x=(w-tw)/2:y=h-44:fontsize=26:fontcolor=white")

wait_start = C["settingup"] + 1.0
wait_end = C.get("reloginStart", C["running"])
after_wait = C.get("reloginEnd", C["running"])
wait_len = max(wait_end - wait_start, 1)
squeeze = wait_len / 4.0                       # show the provisioning wait in ~4 s

segments = [
    # (input index, start, end, speed, caption)
    (0, max(P["login"] - 0.3, 0), P["online"], 1.0, "PROVIDER  ·  sign in, set up node, real hardware detection"),
    (1, max(C["login"] - 0.3, 0), wait_start, 1.0, "CONSUMER  ·  create a VM, matchmaking picks a provider"),
    (1, wait_start, wait_end, squeeze, f"container provisioning  ·  {wait_len:.0f}s shown at {squeeze:.0f}x"),
    (1, after_wait, C["end"], 1.0, "CONSUMER  ·  browser SSH through the FRP relay"),
    (0, P["back"], P["end"], 1.0, "PROVIDER  ·  the VM is running on this machine"),
]

parts, labels = [], []
for i, (src, a, b, speed, text) in enumerate(segments):
    parts.append(f"[{src}:v]trim=start={a:.2f}:end={b:.2f},setpts=(PTS-STARTPTS)/{speed:.3f},"
                 f"fps=30,scale=1440:900,{label(text)}[s{i}]")
    labels.append(f"[s{i}]")
graph = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(labels)}:v=1:a=0[out]"

mp4 = R / "unicore-demo.mp4"
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", prov, "-i", cons, "-filter_complex", graph,
                "-map", "[out]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21",
                "-movflags", "+faststart", str(mp4)], check=True)

gif = R / "demo.gif"
pal = "split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle"
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(mp4), "-vf",
                f"setpts=PTS/1.6,fps=9,scale=800:-1:flags=lanczos,{pal}", str(gif)], check=True)
for f in (mp4, gif):
    print(f.name, round(f.stat().st_size / 1e6, 1), "MB")
