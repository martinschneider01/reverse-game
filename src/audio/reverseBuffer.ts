export type CreateAudioBuffer = (
  numberOfChannels: number,
  length: number,
  sampleRate: number,
) => AudioBuffer;

export function reverseBuffer(
  source: AudioBuffer,
  factory: CreateAudioBuffer | AudioContext,
): AudioBuffer {
  const create: CreateAudioBuffer =
    typeof factory === "function"
      ? factory
      : (channels, length, sampleRate) => factory.createBuffer(channels, length, sampleRate);

  const out = create(source.numberOfChannels, source.length, source.sampleRate);

  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const output = out.getChannelData(channel);
    const last = input.length - 1;
    for (let i = 0; i <= last; i++) {
      output[i] = input[last - i]!;
    }
  }

  return out;
}
