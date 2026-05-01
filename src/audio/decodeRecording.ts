export async function decodeRecording(
  blob: Blob,
  audioContext: AudioContext,
): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return audioContext.decodeAudioData(arrayBuffer);
}
