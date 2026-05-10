import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceAssistantLauncher } from "@/features/voice-assistant/ui/VoiceAssistantLauncher";
import { VoiceAssistantPanel } from "@/features/voice-assistant/ui/VoiceAssistantPanel";
import { useVoiceAssistant } from "@/features/voice-assistant/context/VoiceAssistantContext";

vi.mock("@/features/voice-assistant/context/VoiceAssistantContext", () => ({
  getVoiceAssistantStateLabel: (state: string) => state,
  useVoiceAssistant: vi.fn(),
}));

const baseAssistant = {
  isAvailable: true,
  isPanelOpen: true,
  isVoiceModeActive: false,
  selectedRealtimeModel: "gpt-realtime-2",
  responseMode: "voice",
  state: "ready",
  error: null,
  messages: [],
  liveTranscript: null,
  costEstimate: { audioInputTokens: 0, audioOutputTokens: 0, textInputTokens: 0, textOutputTokens: 0, estimatedUsd: 0 },
  openPanel: vi.fn(),
  closePanel: vi.fn(),
  startVoiceMode: vi.fn(),
  stopVoiceMode: vi.fn(),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  setRealtimeModel: vi.fn(),
  setResponseMode: vi.fn(),
  clearMessages: vi.fn(),
  sendText: vi.fn(),
  interrupt: vi.fn(),
};

describe("VoiceAssistantPanel", () => {
  it("zobrazuje kopírovatelné konverzační okno", () => {
    vi.mocked(useVoiceAssistant).mockReturnValue({
      ...baseAssistant,
      messages: [
        { id: "m1", role: "user", content: "Kdo vyhrál elektro?" },
        { id: "m2", role: "assistant", content: "Vyhrála Alfa Stav, cena 88 000 Kč." },
      ],
    } as any);

    render(<VoiceAssistantPanel />);

    expect(screen.getByText("Konverzace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kopírovat konverzaci" })).toBeEnabled();
    expect(screen.getByText("Kdo vyhrál elektro?").closest(".select-text")).toBeTruthy();
    expect(screen.getByText("Vyhrála Alfa Stav, cena 88 000 Kč.")).toBeInTheDocument();
  });

  it("používá skinované tlačítko pro spuštění Viky", () => {
    vi.mocked(useVoiceAssistant).mockReturnValue(baseAssistant as any);

    render(<VoiceAssistantPanel />);

    expect(screen.getByRole("button", { name: "Zapnout hlasový režim" })).toHaveClass("tf-voice-primary-button");
    expect(screen.getByRole("button", { name: "Odeslat textový dotaz" })).toHaveClass("tf-voice-primary-button");
  });

  it("umožní přepnout hlasový model mezi Realtime 2 a Realtime", () => {
    const setRealtimeModel = vi.fn();
    vi.mocked(useVoiceAssistant).mockReturnValue({
      ...baseAssistant,
      setRealtimeModel,
    } as any);

    render(<VoiceAssistantPanel />);

    expect(screen.getByRole("button", { name: "Realtime 2" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Realtime" }));

    expect(setRealtimeModel).toHaveBeenCalledWith("gpt-realtime");
  });

  it("umožní přepnout odpověď jen do konverzace bez hlasu", () => {
    const setResponseMode = vi.fn();
    vi.mocked(useVoiceAssistant).mockReturnValue({
      ...baseAssistant,
      setResponseMode,
    } as any);

    render(<VoiceAssistantPanel />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Odpovídat jen do konverzace" }));

    expect(setResponseMode).toHaveBeenCalledWith("conversation");
  });

  it("umožní vymazat konverzaci", () => {
    const clearMessages = vi.fn();
    vi.mocked(useVoiceAssistant).mockReturnValue({
      ...baseAssistant,
      clearMessages,
      messages: [
        { id: "m1", role: "user", content: "Vypiš parametry smlouvy." },
      ],
    } as any);

    render(<VoiceAssistantPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Vymazat konverzaci" }));

    expect(clearMessages).toHaveBeenCalled();
  });

  it("zobrazuje průběžný draft odpovědi jako zpětnou vazbu", () => {
    vi.mocked(useVoiceAssistant).mockReturnValue({
      ...baseAssistant,
      state: "responding",
      liveTranscript: { role: "assistant", content: "", isPending: true },
    } as any);

    render(<VoiceAssistantPanel />);

    expect(screen.getByText("Viky připravuje odpověď...")).toBeInTheDocument();
    expect(screen.getAllByText("Viky").some((element) => element.closest(".select-text"))).toBe(true);
  });

  it("zobrazuje živý hlasový přepis uživatele v konverzaci", () => {
    vi.mocked(useVoiceAssistant).mockReturnValue({
      ...baseAssistant,
      liveTranscript: { role: "user", content: "ukaž stavby v brně", isPending: true },
    } as any);

    render(<VoiceAssistantPanel />);

    expect(screen.getByText("ukaž stavby v brně")).toBeInTheDocument();
    expect(screen.getByText("Vy").closest(".select-text")).toBeTruthy();
  });

  it("zobrazuje identitu a avatar Viky v panelu", () => {
    vi.mocked(useVoiceAssistant).mockReturnValue(baseAssistant as any);

    const { container } = render(<VoiceAssistantPanel />);

    expect(screen.getByText("Viky")).toBeInTheDocument();
    expect(screen.getByText("AI asistentka Tender Flow")).toBeInTheDocument();
    expect(container.querySelector('img[src*="viki"]')).toBeTruthy();
  });

  it("zobrazuje avatar Viky v launcheru", () => {
    vi.mocked(useVoiceAssistant).mockReturnValue(baseAssistant as any);

    const { container } = render(<VoiceAssistantLauncher />);

    expect(screen.getByRole("button", { name: "Viky" })).toBeInTheDocument();
    expect(container.querySelector('img[src*="viki"]')).toBeTruthy();
  });
});
