import React, { useState, useEffect } from "react";
import { PublicLayout } from "@/features/public/ui/PublicLayout";
import { PublicHeader } from "@/features/public/ui/PublicHeader";
import { AuthCard } from "./AuthCard";
import { Link, useLocation } from "@/shared/routing/router";
import { authService } from "@/services/authService";

export const ResetPasswordPage: React.FC = () => {
    const { search } = useLocation();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [token, setToken] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        // Parse token from query string ?token=...
        const params = new URLSearchParams(search);
        const tokenParam = params.get("token");
        if (tokenParam) {
            setToken(tokenParam);
        } else {
            setErrorMessage("Neplatný odkaz (chybí token).");
            setStatus("error");
        }
    }, [search]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        if (password.length < 6) {
            setErrorMessage("Heslo musí mít alespoň 6 znaků.");
            setStatus("error");
            return;
        }

        if (password !== confirmPassword) {
            setErrorMessage("Hesla se neshodují.");
            setStatus("error");
            return;
        }

        setStatus("loading");
        setErrorMessage("");

        try {
            await authService.confirmPasswordReset(token, password);
            setStatus("success");
        } catch (error: any) {
            console.error("Reset confirmation error:", error);
            setStatus("error");
            let msg = "Nastavení hesla se nezdařilo. Odkaz může být expirovaný.";

            // Try to parse error message from exception if possible
            if (error && error.message) {
                if (error.message.includes("expirovaný")) msg = "Odkaz pro obnovu hesla vypršel.";
                else if (error.message.includes("Neplatný")) msg = "Neplatný odkaz pro obnovu hesla.";
            }

            setErrorMessage(msg);
        }
    };

    return (
        <PublicLayout>
            <PublicHeader variant="auth" />
            <AuthCard title="Nové heslo" subtitle="Nastavte si nové heslo">
                {status === "success" ? (
                    <div className="flex flex-col gap-4 text-center">
                        <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl">
                            <p className="font-medium">Heslo změněno!</p>
                            <p className="text-sm mt-1 opacity-90">
                                Vaše heslo bylo úspěšně nastaveno. Nyní se můžete přihlásit.
                            </p>
                        </div>
                        <Link
                            to="/login"
                            className="w-full text-center py-3.5 px-6 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-lg shadow-orange-500/20"
                        >
                            Přejít na přihlášení
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {status === "error" && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
                                {errorMessage}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <input
                                    type="password"
                                    placeholder="Nové heslo"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                                    required
                                    disabled={status === "loading" || !token}
                                    minLength={6}
                                />
                            </div>
                            <div>
                                <input
                                    type="password"
                                    placeholder="Potvrzení hesla"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                                    required
                                    disabled={status === "loading" || !token}
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={status === "loading" || !token}
                            className="w-full text-center py-3.5 px-6 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white rounded-xl font-medium transition-colors shadow-lg shadow-orange-500/20 flex justify-center items-center mt-2"
                        >
                            {status === "loading" ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Nastavit heslo"
                            )}
                        </button>

                        <div className="flex items-center justify-center text-sm text-white/50">
                            <Link to="/login" className="hover:text-white transition-colors">
                                Zpět na přihlášení
                            </Link>
                        </div>
                    </form>
                )}
            </AuthCard>
        </PublicLayout>
    );
};
