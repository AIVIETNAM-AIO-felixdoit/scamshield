"""Mux recorded frames + narration into build/ScamShield-demo.mp4 (1080p30, H.264 + AAC)."""
import json, pathlib, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUILD = ROOT / 'build'
tl = json.loads((BUILD / 'timeline.json').read_text())

inputs = ['-f', 'concat', '-safe', '0', '-i', str(BUILD / 'frames.txt')]
filters, labels = [], []
for i, s in enumerate(tl['segments'], start=1):
    inputs += ['-i', str(BUILD / 'audio' / f"{s['id']}.wav")]
    ms = int(s['start'] * 1000)
    filters.append(f'[{i}:a]aresample=48000,adelay={ms}|{ms}[a{i}]')
    labels.append(f'[a{i}]')
filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,"
               f"apad,atrim=0:{tl['total']:.3f}[aout]")
filters.append('[0:v]fps=30,scale=1920:1080:flags=lanczos,format=yuv420p[vout]')

out = BUILD / 'ScamShield-demo.mp4'
cmd = ['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filters),
       '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
       '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', f"{tl['total']:.3f}", str(out)]
subprocess.run(cmd, check=True)
print('wrote', out)
