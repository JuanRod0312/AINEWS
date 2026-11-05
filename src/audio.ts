import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadEnvFile } from "node:process";
import type { AppConfig, PodcastHost, PodcastTurn } from "./types.js";

const apiBaseUrl = "https://api.elevenlabs.io";

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  category: string;
  labels: Record<string, string>;
}

interface SpeechClient {
  createSpeech(voiceId: string, text: string, model: string, outputFormat: string): Promise<Buffer>;
}

export class ElevenLabsClient implements SpeechClient {
  constructor(
    private readonly apiKey = elevenLabsApiKey(),
    private readonly request: typeof fetch = fetch
  ) {}

  async listVoices(): Promise<ElevenLabsVoice[]> {
    const voices: ElevenLabsVoice[] = [];
    let nextPageToken: string | undefined;
    do {
      const url = new URL("/v2/voices", apiBaseUrl);
      url.searchParams.set("page_size", "100");
      url.searchParams.set("sort", "name");
      url.searchParams.set("sort_direction", "asc");
      if (nextPageToken) url.searchParams.set("next_page_token", nextPageToken);
      const response = await this.request(url, { headers: { "xi-api-key": this.apiKey } });
      if (!response.ok) throw await apiError("list voices", response);
      const body = await response.json() as {
        voices?: Array<{ voice_id?: string; name?: string; category?: string; labels?: Record<string, string> }>;
        has_more?: boolean;
        next_page_token?: string | null;
      };
      for (const voice of body.voices ?? []) {
        if (!voice.voice_id || !voice.name) continue;
        voices.push({
          voiceId: voice.voice_id,
          name: voice.name,
          category: voice.category ?? "unknown",
          labels: voice.labels ?? {}
        });
      }
      nextPageToken = body.has_more && body.next_page_token ? body.next_page_token : undefined;
    } while (nextPageToken);
    return voices;
  }

  async createSpeech(voiceId: string, text: string, model: string, outputFormat: string): Promise<Buffer> {
    const url = new URL(`/v1/text-to-speech/${encodeURIComponent(voiceId)}`, apiBaseUrl);
    url.searchParams.set("output_format", outputFormat);
    const response = await this.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": this.apiKey
      },
      body: JSON.stringify({ text, model_id: model })
    });
    if (!response.ok) throw await apiError(`synthesize ${voiceId}`, response);
    return Buffer.from(await response.arrayBuffer());
  }
}

export async function synthesizePodcast(
  config: AppConfig,
  episodeDirectory: string,
  client: SpeechClient = new ElevenLabsClient()
): Promise<string> {
  validateAudioConfig(config);
  const scriptPath = join(episodeDirectory, "script.md");
  const turns = parsePodcastScript(await readFile(scriptPath, "utf8"));
  const segments: Buffer[] = [];
  for (const turn of turns) {
    const voiceId = turn.host === "HOST A" ? config.audio.hostAVoiceId : config.audio.hostBVoiceId;
    segments.push(await client.createSpeech(voiceId, turn.text, config.audio.model, config.audio.outputFormat));
  }
  const outputPath = join(episodeDirectory, "episode.mp3");
  const temporaryPath = join(episodeDirectory, `.${basename(outputPath)}.tmp`);
  await writeFile(temporaryPath, concatenateMp3Segments(segments));
  await rename(temporaryPath, outputPath);
  return outputPath;
}

export function concatenateMp3Segments(segments: Buffer[]): Buffer {
  return Buffer.concat(segments.flatMap((segment) => stripMp3MetadataStreams(segment)));
}

export function parsePodcastScript(script: string): PodcastTurn[] {
  const turns: PodcastTurn[] = [];
  let current: PodcastTurn | undefined;
  for (const line of script.split(/\r?\n/)) {
    const match = line.match(/^\*\*(HOST [AB]):\*\*\s*(.+)$/);
    if (match) {
      if (current) turns.push(current);
      current = { host: match[1] as PodcastHost, text: match[2]!.trim() };
      continue;
    }
    const trimmed = line.trim();
    if (current && trimmed && !trimmed.startsWith("#")) current.text += ` ${trimmed}`;
  }
  if (current) turns.push(current);
  if (turns.length === 0) throw new Error("The script contains no HOST A or HOST B dialogue.");
  if (!turns.some((turn) => turn.host === "HOST A") || !turns.some((turn) => turn.host === "HOST B")) {
    throw new Error("The script must contain dialogue for both HOST A and HOST B.");
  }
  return turns;
}

export function podcastPreview(script: string): { turns: number; characters: number } {
  const turns = parsePodcastScript(script);
  return { turns: turns.length, characters: turns.reduce((total, turn) => total + turn.text.length, 0) };
}

function validateAudioConfig(config: AppConfig): void {
  if (!config.audio.hostAVoiceId || !config.audio.hostBVoiceId) {
    throw new Error("Set audio.hostAVoiceId and audio.hostBVoiceId in the selected config before synthesis.");
  }
  if (config.audio.hostAVoiceId === config.audio.hostBVoiceId) {
    throw new Error("Host A and Host B must use distinct ElevenLabs voice IDs.");
  }
}

function elevenLabsApiKey(): string {
  if (existsSync(".env")) loadEnvFile(".env");
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is missing. Add it to the ignored root .env file.");
  return apiKey;
}

async function apiError(action: string, response: Response): Promise<Error> {
  const details = (await response.text()).slice(0, 500);
  return new Error(`ElevenLabs could not ${action} (${response.status} ${response.statusText})${details ? `: ${details}` : ""}`);
}

function stripMp3MetadataStreams(buffer: Buffer): Buffer[] {
  const starts: number[] = [];
  for (let index = 0; index <= buffer.length - 10; index += 1) {
    if (isId3Header(buffer, index)) starts.push(index);
  }
  if (starts.length === 0) return [buffer];
  const audio: Buffer[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index]!;
    const end = starts[index + 1] ?? buffer.length;
    const tagSize = 10 + synchsafeInteger(buffer, start + 6);
    let audioStart = start + tagSize;
    const frameStart = findMpegFrame(buffer, audioStart, end);
    if (frameStart >= 0) {
      audioStart = frameStart;
      const frameLength = mpegFrameLength(buffer, frameStart);
      if (frameLength > 0 && frameStart + frameLength <= end) {
        const firstFrame = buffer.subarray(frameStart, frameStart + frameLength);
        if (firstFrame.includes(Buffer.from("Info")) || firstFrame.includes(Buffer.from("Xing"))) {
          audioStart = frameStart + frameLength;
        }
      }
    }
    if (audioStart < end) audio.push(buffer.subarray(audioStart, end));
  }
  return audio;
}

function isId3Header(buffer: Buffer, offset: number): boolean {
  return buffer[offset] === 0x49 && buffer[offset + 1] === 0x44 && buffer[offset + 2] === 0x33
    && (buffer[offset + 3] ?? 0xff) <= 4
    && [6, 7, 8, 9].every((index) => ((buffer[offset + index] ?? 0xff) & 0x80) === 0);
}

function synchsafeInteger(buffer: Buffer, offset: number): number {
  return ((buffer[offset] ?? 0) << 21) | ((buffer[offset + 1] ?? 0) << 14)
    | ((buffer[offset + 2] ?? 0) << 7) | (buffer[offset + 3] ?? 0);
}

function findMpegFrame(buffer: Buffer, start: number, end: number): number {
  for (let index = start; index < Math.min(end - 1, start + 4096); index += 1) {
    if (buffer[index] === 0xff && ((buffer[index + 1] ?? 0) & 0xe0) === 0xe0) return index;
  }
  return -1;
}

function mpegFrameLength(buffer: Buffer, offset: number): number {
  const header = buffer.readUInt32BE(offset);
  const versionBits = (header >>> 19) & 0x3;
  const layerBits = (header >>> 17) & 0x3;
  const bitrateIndex = (header >>> 12) & 0xf;
  const sampleRateIndex = (header >>> 10) & 0x3;
  const padding = (header >>> 9) & 0x1;
  if (versionBits !== 0x3 || layerBits !== 0x1 || sampleRateIndex === 0x3) return 0;
  const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const sampleRates = [44100, 48000, 32000];
  const bitrate = bitrates[bitrateIndex] ?? 0;
  const sampleRate = sampleRates[sampleRateIndex] ?? 0;
  return bitrate && sampleRate ? Math.floor((144 * bitrate * 1000) / sampleRate) + padding : 0;
}
