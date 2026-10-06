import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withMicrophoneTimeout } from "./microphone-request";

function microphone() {
  let stopped = 0;
  const stream = {
    getTracks: () => [
      {
        stop: () => {
          stopped += 1;
        },
      },
    ],
  } as unknown as MediaStream;
  return { stream, stopped: () => stopped };
}

describe("microphone permission", () => {
  it("keeps the granted microphone available to the voice channel", async () => {
    const mic = microphone();
    assert.equal(
      await withMicrophoneTimeout(Promise.resolve(mic.stream), 100),
      mic.stream,
    );
    assert.equal(mic.stopped(), 0);
  });

  it("releases the microphone when permission is granted after the attempt timed out", async () => {
    const mic = microphone();
    let grant!: (stream: MediaStream) => void;
    const permission = new Promise<MediaStream>((resolve) => {
      grant = resolve;
    });
    await assert.rejects(
      withMicrophoneTimeout(permission, 5),
      /Нет ответа от микрофона/,
    );
    grant(mic.stream);
    await permission;
    assert.equal(mic.stopped(), 1);
  });

  it("preserves a system permission denial so the UI can report it", async () => {
    const denied = new Error("Permission denied");
    denied.name = "NotAllowedError";
    await assert.rejects(
      withMicrophoneTimeout(Promise.reject(denied), 100),
      (error) => error === denied,
    );
  });
});
