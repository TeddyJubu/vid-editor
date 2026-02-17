type Chunk = {
  data: Uint8Array;
  timestampMs: number;
  keyframe: boolean;
};

function u8(...bytes: number[]) {
  return new Uint8Array(bytes);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

function ebmlId(id: number): Uint8Array {
  const bytes: number[] = [];
  let v = id >>> 0;
  // IDs are 1-4 bytes; emit big-endian.
  while (v > 0) {
    bytes.push(v & 0xff);
    v = v >>> 8;
  }
  bytes.reverse();
  return new Uint8Array(bytes.length ? bytes : [0]);
}

function vintForSize(size: number): Uint8Array {
  // EBML "vint" for element sizes.
  const value = Math.max(0, Math.trunc(size));
  for (let length = 1; length <= 8; length += 1) {
    const max = Math.pow(2, 7 * length) - 2; // reserve all-1s for unknown
    if (value <= max) {
      const out = new Uint8Array(length);
      let v = value;
      for (let i = length - 1; i >= 0; i -= 1) {
        out[i] = v & 0xff;
        v = v >>> 8;
      }
      out[0] |= 1 << (8 - length);
      return out;
    }
  }
  throw new Error("Size too large for EBML vint");
}

function unknownSize(length: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): Uint8Array {
  const out = new Uint8Array(length);
  out.fill(0xff);
  out[0] = (1 << (8 - length)) | ((1 << (8 - length)) - 1);
  return out;
}

function uintBE(value: number): Uint8Array {
  const v = Math.max(0, Math.trunc(value));
  let bytes = 1;
  while (bytes < 8 && v >= Math.pow(2, bytes * 8)) bytes += 1;
  const out = new Uint8Array(bytes);
  let tmp = v;
  for (let i = bytes - 1; i >= 0; i -= 1) {
    out[i] = tmp & 0xff;
    tmp = tmp >>> 8;
  }
  return out;
}

function float64BE(value: number): Uint8Array {
  const out = new Uint8Array(8);
  const dv = new DataView(out.buffer);
  dv.setFloat64(0, value, false);
  return out;
}

function str(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function el(id: number, data: Uint8Array): Uint8Array {
  return concat([ebmlId(id), vintForSize(data.byteLength), data]);
}

function master(id: number, children: Uint8Array[]): Uint8Array {
  return el(id, concat(children));
}

function simpleBlock(trackNumber: number, timecode: number, keyframe: boolean, frame: Uint8Array) {
  // TrackNumber as EBML vint; for 1 => 0x81.
  const tn = u8(0x80 | (trackNumber & 0x7f));
  const tc = new Uint8Array(2);
  const t = (timecode << 16) >> 16; // int16
  tc[0] = (t >> 8) & 0xff;
  tc[1] = t & 0xff;
  const flags = u8(keyframe ? 0x80 : 0x00);
  return concat([tn, tc, flags, frame]);
}

function buildCluster(chunks: Chunk[], clusterTimeMs: number): Uint8Array {
  const children: Uint8Array[] = [el(0xe7, uintBE(clusterTimeMs))];
  for (const c of chunks) {
    const rel = c.timestampMs - clusterTimeMs;
    children.push(el(0xa3, simpleBlock(1, rel, c.keyframe, c.data)));
  }
  return master(0x1f43b675, children);
}

/**
 * Minimal WebM muxer for VP8-encoded chunks (WebCodecs VideoEncoder output).
 * MVP limitations: no Cues, and clusters are split to keep SimpleBlock timecode within int16.
 */
export function muxVp8Webm(input: {
  width: number;
  height: number;
  fps: number;
  chunks: Chunk[];
}): Uint8Array {
  const durationMs =
    input.chunks.length > 0
      ? Math.max(0, input.chunks[input.chunks.length - 1]!.timestampMs) +
        Math.round(1000 / Math.max(1, input.fps))
      : 0;
  const durationSec = durationMs / 1000;
  const frameDurationNs = Math.round(1_000_000_000 / Math.max(1, input.fps));

  const ebmlHeader = master(0x1a45dfa3, [
    el(0x4286, uintBE(1)),
    el(0x42f7, uintBE(1)),
    el(0x42f2, uintBE(4)),
    el(0x42f3, uintBE(8)),
    el(0x4282, str("webm")),
    el(0x4287, uintBE(2)),
    el(0x4285, uintBE(2)),
  ]);

  const info = master(0x1549a966, [
    el(0x2ad7b1, uintBE(1_000_000)), // TimecodeScale = 1ms
    el(0x4d80, str("VidEditor")),
    el(0x5741, str("VidEditor")),
    el(0x4489, float64BE(durationSec)),
  ]);

  const trackEntry = master(0xae, [
    el(0xd7, uintBE(1)),
    el(0x73c5, uintBE(1)),
    el(0x83, uintBE(1)), // video
    el(0x9c, uintBE(0)), // no lacing
    el(0x86, str("V_VP8")),
    el(0x23e383, uintBE(frameDurationNs)),
    master(0xe0, [el(0xb0, uintBE(input.width)), el(0xba, uintBE(input.height))]),
  ]);

  const tracks = master(0x1654ae6b, [trackEntry]);

  const clusters: Uint8Array[] = [];
  const maxRelMs = 30_000; // keep < 32767
  let clusterStart = 0;
  let clusterChunks: Chunk[] = [];
  for (const c of input.chunks) {
    if (clusterChunks.length === 0) clusterStart = c.timestampMs;
    const rel = c.timestampMs - clusterStart;
    if (rel > maxRelMs) {
      clusters.push(buildCluster(clusterChunks, clusterStart));
      clusterChunks = [];
      clusterStart = c.timestampMs;
    }
    clusterChunks.push(c);
  }
  if (clusterChunks.length) clusters.push(buildCluster(clusterChunks, clusterStart));

  // Segment with unknown size.
  const segmentId = ebmlId(0x18538067);
  const segment = concat([segmentId, unknownSize(8), info, tracks, ...clusters]);
  return concat([ebmlHeader, segment]);
}
