"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const APP_ID = "629323992623834";
const CONFIG_ID = "1122196270494238";

type Sess = {
  waba_id?: string;
  phone_number_id?: string;
  business_id?: string;
  flow_type?: string;
};

type Resposta = { status?: string; authResponse?: { code?: string } };

type Fb = {
  init: (o: Record<string, unknown>) => void;
  login: (cb: (r: Resposta) => void, o: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    FB?: Fb;
    fbAsyncInit?: () => void;
  }
}

export default function ConectarWhatsApp() {
  const [token, setToken] = useState<string | null>(null);
  const [fase, setFase] = useState<"load" | "ready" | "busy" | "ok" | "error">("load");
  const [detalhe, setDetalhe] = useState("");
  const [dica, setDica] = useState("");
  const sess = useRef<Sess>({});
  const alarme = useRef<number | null>(null);

  const pararAlarme = useCallback(() => {
    if (alarme.current) {
      window.clearTimeout(alarme.current);
      alarme.current = null;
    }
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (!t) {
      setFase("error");
      setDetalhe("Link sem token de conexão.");
      return;
    }

    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; event?: string; data?: Sess } | undefined;
      if (!d || d.type !== "WA_EMBEDDED_SIGNUP") return;
      if (d.event && d.event.indexOf("FINISH") === 0 && d.data) {
        sess.current = { ...sess.current, ...d.data };
      }
    };
    window.addEventListener("message", onMsg);

    const boot = () => {
      try {
        window.FB?.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: "v24.0" });
        setFase("ready");
      } catch (e) {
        setFase("error");
        setDetalhe("FB.init falhou: " + (e instanceof Error ? e.message : String(e)));
      }
    };

    if (window.FB) {
      boot();
      return () => {
        window.removeEventListener("message", onMsg);
        pararAlarme();
      };
    }

    window.fbAsyncInit = boot;
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.onerror = () => {
      setFase("error");
      setDetalhe("Não foi possível carregar o SDK do Facebook.");
    };
    document.body.appendChild(s);

    return () => {
      window.removeEventListener("message", onMsg);
      pararAlarme();
    };
  }, [pararAlarme]);

  const conectar = useCallback(() => {
    if (!token) return;
    if (!window.FB) {
      setFase("error");
      setDetalhe("SDK do Facebook não carregou. Recarregue a página.");
      return;
    }

    setFase("busy");
    setDetalhe("");
    setDica("");
    pararAlarme();

    alarme.current = window.setTimeout(() => {
      setDica(
        "A janela do Facebook não abriu. Libere pop-ups para revolutionx.com.br e clique em Tentar de novo.",
      );
    }, 5000);

    const tratar = async (resp: Resposta) => {
      pararAlarme();
      const code = resp?.authResponse?.code;

      if (!code) {
        setFase("ready");
        setDica("");
        setDetalhe(`Login não concluído (status: ${resp?.status ?? "sem resposta"}).`);
        return;
      }

      const s = sess.current;

      try {
        const r = await fetch("/api/integrations/openbsp/onboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            code,
            application_id: APP_ID,
            waba_id: s.waba_id,
            phone_number_id: s.phone_number_id,
            business_id: s.business_id,
            flow_type: s.flow_type,
          }),
        });
        const j = await r.json();

        if (!j.ok) {
          const causa = j.cause as { error?: { message?: string }; message?: string } | string | null;
          const extra =
            typeof causa === "string"
              ? causa
              : causa?.error?.message ?? causa?.message ?? "";
          setFase("error");
          setDica("");
          setDetalhe([j.message, extra].filter(Boolean).join(" — ") || `Falha ${j.status}`);
          return;
        }

        setFase("ok");
        setDica("");
        fetch("/api/integrations/openbsp/status", { cache: "no-store" }).catch(() => {});
        if (window.opener) {
          try {
            (window.opener as Window).postMessage("openbsp-connected", "*");
          } catch {}
          setTimeout(() => window.close(), 2500);
        }
      } catch (e) {
        setFase("error");
        setDetalhe(e instanceof Error ? e.message : "Falha de rede.");
      }
    };

    try {
      window.FB.login(
        function (resp) {
          void tratar(resp);
        },
        {
          config_id: CONFIG_ID,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3",
          },
        },
      );
    } catch (e) {
      pararAlarme();
      setFase("error");
      setDetalhe("FB.login falhou: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [token, pararAlarme]);

  const podeTentar = fase === "error" || (fase === "busy" && dica !== "");

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#08090d", color: "#e8e8ea", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <div style={{ width: 360, display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: -0.5 }}>Revolution X</div>
        <div style={{ fontSize: 14, color: "#9a9aa2" }}>Conectar número do WhatsApp</div>

        {fase === "ok" && (
          <div style={{ fontSize: 14, color: "#22c55e" }}>
            Número conectado. Pode fechar esta janela.
          </div>
        )}

        {fase === "error" && detalhe && (
          <div style={{ fontSize: 13, color: "#ef4444", wordBreak: "break-word" }}>{detalhe}</div>
        )}

        {fase === "ready" && detalhe && (
          <div style={{ fontSize: 13, color: "#f59e0b", wordBreak: "break-word" }}>{detalhe}</div>
        )}

        {dica && <div style={{ fontSize: 12, color: "#f59e0b", lineHeight: 1.5 }}>{dica}</div>}

        <button
          onClick={conectar}
          disabled={fase !== "ready"}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: 0,
            background: fase === "ready" ? "#4267b2" : "#2a2d36",
            color: fase === "ready" ? "#fff" : "#8b8b93",
            fontSize: 14,
            fontWeight: 600,
            cursor: fase === "ready" ? "pointer" : "default",
          }}
        >
          {fase === "busy" ? "Conectando..." : fase === "load" ? "Carregando..." : "Continuar com Facebook"}
        </button>

        {podeTentar && (
          <button
            onClick={conectar}
            style={{ background: "transparent", border: "1px solid #2a2d36", color: "#9a9aa2", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
          >
            Tentar de novo
          </button>
        )}

        <div style={{ fontSize: 11, color: "#6b6b74", lineHeight: 1.5 }}>
          Use a conta Meta dona do número. Se você usa o WhatsApp Business no celular, pode manter o app.
        </div>
      </div>
    </main>
  );
}
