import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { concatenateMp3Segments, parsePodcastScript, podcastPreview, synthesizePodcast } from "../src/audio.js";
import type { AppConfig } from "../src/types.js";

const script = `# Briefing

**HOST A:** Welcome to the briefing.

## Story

**HOST B:** Let's examine the evidence.

**HOST A:** There is an important limitation.
`;

test("podcast scripts are parsed into ordered host turns", () => {
  assert.deepEqual(parsePodcastScript(script), [
    { host: "HOST A", text: "Welcome to the briefing." },
    { host: "HOST B", text: "Let's examine the evidence." },
    { host: "HOST A", text: "There is an important limitation." }
  ]);
  assert.deepEqual(podcastPreview(script), { turns: 3, characters: 84 });
});

test("synthesis assigns voices and writes a combined mp3", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ainews-audio-"));
  await writeFile(join(directory, "script.md"), script, "utf8");
  const calls: Array<{ voiceId: string; text: string }> = [];
  const config = {
    audio: {
      provider: "elevenlabs",
      model: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
      hostAVoiceId: "voice-a",
      hostBVoiceId: "voice-b"
    }
  } as AppConfig;
  const output = await synthesizePodcast(config, directory, {
    async createSpeech(voiceId, text) {
      calls.push({ voiceId, text });
      return Buffer.from(`[${voiceId}]`);
    }
  });
  assert.deepEqual(calls.map((call) => call.voiceId), ["voice-a", "voice-b", "voice-a"]);
  assert.equal((await readFile(output)).toString(), "[voice-a][voice-b][voice-a]");
});

test("synthesis rejects missing or identical host voices before API calls", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ainews-audio-"));
  await writeFile(join(directory, "script.md"), script, "utf8");
  const base = {
    provider: "elevenlabs" as const,
    model: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128" as const,
    hostAVoiceId: "",
    hostBVoiceId: ""
  };
  await assert.rejects(() => synthesizePodcast({ audio: base } as AppConfig, directory, { createSpeech: async () => Buffer.alloc(0) }), /Set audio/);
  await assert.rejects(() => synthesizePodcast({ audio: { ...base, hostAVoiceId: "same", hostBVoiceId: "same" } } as AppConfig, directory, { createSpeech: async () => Buffer.alloc(0) }), /distinct/);
});

test("MP3 concatenation removes per-segment ID3 and duration headers", () => {
  const makeSegment = (fill: number) => {
    const id3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0]);
    const infoFrame = Buffer.alloc(417);
    infoFrame.set([0xff, 0xfb, 0x90, 0xc0]);
    infoFrame.write("Info", 36, "ascii");
    const audioFrame = Buffer.alloc(417, fill);
    audioFrame.set([0xff, 0xfb, 0x90, 0xc0]);
    return Buffer.concat([id3, infoFrame, audioFrame]);
  };
  const joined = concatenateMp3Segments([makeSegment(1), makeSegment(2)]);
  assert.equal(joined.length, 834);
  assert.deepEqual(joined.subarray(0, 4), Buffer.from([0xff, 0xfb, 0x90, 0xc0]));
  assert.deepEqual(joined.subarray(417, 421), Buffer.from([0xff, 0xfb, 0x90, 0xc0]));
  assert.equal(joined.includes(Buffer.from("ID3")), false);
  assert.equal(joined.includes(Buffer.from("Info")), false);
});
