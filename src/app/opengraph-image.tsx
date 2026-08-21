import { ImageResponse } from "next/og";

export const alt = "ShadowGuard — Open-Source AI Governance";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#94a3b8",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#ef4444",
              boxShadow: "0 0 12px #ef4444",
            }}
          />
          <span>Apache-2.0 · Self-hosted</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 96,
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              fontWeight: 500,
              maxWidth: 1000,
            }}
          >
            Run AI governance on infrastructure you control.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#cbd5e1",
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            Discovery, assessments, AgentGuard, MCP governance, evidence, and
            reporting without a hosted ShadowGuard service.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderTop: "1px solid #334155",
            paddingTop: 28,
            fontSize: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontWeight: 600 }}>ShadowGuard</span>
            <span style={{ color: "#475569" }}>+</span>
            <span
              style={{
                fontFamily: "monospace",
                letterSpacing: "0.12em",
                color: "#94a3b8",
                textTransform: "uppercase",
                fontSize: 22,
              }}
            >
              AgentGuard
            </span>
          </div>
          <div style={{ color: "#64748b", fontSize: 20 }}>Open source · Provided as-is</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
