import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectRealtimeVoice } from "@/features/voice-assistant/api/webrtcClient";

let lastDataChannel: {
  readyState: string;
  addEventListener: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

class MockPeerConnection {
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;

  addTrack = vi.fn();
  createDataChannel = vi.fn(() => {
    lastDataChannel = {
    readyState: "open",
    addEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    };
    return lastDataChannel;
  });
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "offer-sdp" }));
  setLocalDescription = vi.fn(async (offer: RTCSessionDescriptionInit) => {
    this.localDescription = offer;
  });
  setRemoteDescription = vi.fn(async (answer: RTCSessionDescriptionInit) => {
    this.remoteDescription = answer;
  });
  close = vi.fn();
}

describe("connectRealtimeVoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastDataChannel = undefined as any;
    vi.stubGlobal("RTCPeerConnection", MockPeerConnection);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => "answer-sdp",
      })),
    );
  });

  it("posílá SDP na aktuální OpenAI Realtime calls endpoint", async () => {
    const stream = {
      getAudioTracks: () => [{ enabled: true }],
      getTracks: () => [],
    } as unknown as MediaStream;

    await connectRealtimeVoice({
      session: {
        clientSecret: "ek_test",
        expiresAt: "2026-05-09T20:00:00.000Z",
        sessionId: "session-1",
        model: "gpt-realtime-2",
      },
      stream,
      onEvent: vi.fn(),
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls",
      expect.objectContaining({
        method: "POST",
        body: "offer-sdp",
        headers: expect.objectContaining({
          Authorization: "Bearer ek_test",
          "content-type": "application/sdp",
        }),
      }),
    );
    expect(JSON.stringify((fetch as any).mock.calls)).not.toContain("/v1/realtime?model=");
  });

  it("odesílá realtime eventy přes data channel", async () => {
    const stream = {
      getAudioTracks: () => [{ enabled: true }],
      getTracks: () => [],
    } as unknown as MediaStream;

    const connection = await connectRealtimeVoice({
      session: {
        clientSecret: "ek_test",
        expiresAt: "2026-05-09T20:00:00.000Z",
        sessionId: "session-1",
        model: "gpt-realtime-2",
      },
      stream,
      onEvent: vi.fn(),
    });

    connection.sendEvent({ type: "response.create", response: { output_modalities: ["text"] } });

    expect(lastDataChannel.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "response.create", response: { output_modalities: ["text"] } }),
    );
  });
});
