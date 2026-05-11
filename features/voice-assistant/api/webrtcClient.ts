import type { RealtimeSessionResponse } from "../types";

export type RealtimeEventHandler = (event: Record<string, unknown>) => void;

export type RealtimeConnection = {
  setMicEnabled: (enabled: boolean) => void;
  sendEvent: (event: Record<string, unknown>) => void;
  close: () => void;
};

export const connectRealtimeVoice = async (input: {
  session: RealtimeSessionResponse;
  stream: MediaStream;
  onEvent: RealtimeEventHandler;
}): Promise<RealtimeConnection> => {
  const peer = new RTCPeerConnection();
  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.setAttribute("aria-hidden", "true");

  peer.ontrack = (event) => {
    audio.srcObject = event.streams[0];
  };

  for (const track of input.stream.getAudioTracks()) {
    track.enabled = false;
    peer.addTrack(track, input.stream);
  }

  const dataChannel = peer.createDataChannel("oai-events");
  dataChannel.addEventListener("message", (event) => {
    try {
      input.onEvent(JSON.parse(event.data));
    } catch {
      input.onEvent({ type: "client.invalid_event" });
    }
  });

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);

  const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.session.clientSecret}`,
      "content-type": "application/sdp",
    },
    body: offer.sdp,
  });

  if (!sdpResponse.ok) {
    const detail = await sdpResponse.text().catch(() => "");
    const suffix = detail.trim() ? ` (${detail.slice(0, 220)})` : "";
    throw new Error(`Nepodařilo se navázat realtime spojení.${suffix}`);
  }

  await peer.setRemoteDescription({
    type: "answer",
    sdp: await sdpResponse.text(),
  });

  await new Promise<void>((resolve) => {
    if (dataChannel.readyState === "open") {
      resolve();
      return;
    }

    const timeout = window.setTimeout(resolve, 2_500);
    dataChannel.addEventListener(
      "open",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });

  return {
    setMicEnabled: (enabled) => {
      for (const track of input.stream.getAudioTracks()) {
        track.enabled = enabled;
      }
    },
    sendEvent: (event) => {
      if (dataChannel.readyState === "open") {
        dataChannel.send(JSON.stringify(event));
      }
    },
    close: () => {
      dataChannel.close();
      peer.close();
      audio.srcObject = null;
      for (const track of input.stream.getTracks()) {
        track.stop();
      }
    },
  };
};
