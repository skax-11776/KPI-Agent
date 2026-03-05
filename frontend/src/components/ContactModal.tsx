/**
 * ContactModal.tsx — 현장 담당자 연결 모달
 *
 * ✏️ 담당자 정보 수정 방법:
 *   아래 CONTACTS 배열의 name / role / phone / teams / email 만 바꾸면 됩니다.
 *   - teams : Microsoft Teams 딥링크 (users= 뒤에 회사 이메일 입력)
 *   - email : Outlook 메일 주소
 */

import React from "react";

// ─────────────────────────────────────────────
// 담당자 목록 — 여기만 수정하세요
// ─────────────────────────────────────────────
export const CONTACTS = [
  {
    name:  "김현장",
    role:  "LINE1 담당",
    phone: "010-1234-5678",
    teams: "https://teams.microsoft.com/l/chat/0/0?users=kim.hyunjang@company.com",
    email: "kim.hyunjang@company.com",
  },
  {
    name:  "이설비",
    role:  "LINE2 담당",
    phone: "010-2345-6789",
    teams: "https://teams.microsoft.com/l/chat/0/0?users=lee.seolbi@company.com",
    email: "lee.seolbi@company.com",
  },
  {
    name:  "박공정",
    role:  "LINE3 담당",
    phone: "010-3456-7890",
    teams: "https://teams.microsoft.com/l/chat/0/0?users=park.gongjung@company.com",
    email: "park.gongjung@company.com",
  },
];

// ─────────────────────────────────────────────
// 메일 기본 양식 — 필요 시 수정
// ─────────────────────────────────────────────
const MAIL_SUBJECT = "[KPI알람] EQP12 THP 이상 알람 발생";
const mailBody = (name: string) =>
  `안녕하세요 ${name}님,\n\n[알람 요약]\n- 일시: 2026-01-31 09:10\n- 장비: EQP12 / LINE2 / OPER4\n- KPI: THP 이상\n- 목표: 250 / 실적: 227 (-23)\n\n조치 부탁드립니다.\n\nKPI Monitoring System`;

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface ContactModalProps {
  open: boolean;
  onClose: () => void;
}

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────
const ContactModal: React.FC<ContactModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: 14, padding: "28px 32px",
          minWidth: 420, maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>📞 현장 담당자 연결</div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}
          >✕</button>
        </div>

        {/* 담당자 카드 */}
        {CONTACTS.map((c, i) => (
          <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 18px", marginBottom: 12, background: "#f9fafb" }}>
            {/* 이름 / 역할 / 전화 */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", background: "#0f172a",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, color: "#fff", fontWeight: 700, flexShrink: 0,
              }}>
                {c.name[0]}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{c.role}</div>
              </div>
              <a
                href={`tel:${c.phone.replace(/-/g, "")}`}
                style={{ marginLeft: "auto", fontSize: 12, color: "#374151", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
              >
                📱 {c.phone}
              </a>
            </div>

            {/* Teams / Outlook 버튼 */}
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={c.teams} target="_blank" rel="noreferrer"
                style={{ flex: 1, textAlign: "center" as const, padding: "7px 0", borderRadius: 7, background: "#5b4fcf", color: "#fff", fontWeight: 700, fontSize: 12, textDecoration: "none" }}
              >
                Teams 채팅
              </a>
              <a
                href={`mailto:${c.email}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(mailBody(c.name))}`}
                style={{ flex: 1, textAlign: "center" as const, padding: "7px 0", borderRadius: 7, background: "#0078d4", color: "#fff", fontWeight: 700, fontSize: 12, textDecoration: "none" }}
              >
                Outlook 메일
              </a>
            </div>
          </div>
        ))}

        <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" as const, marginTop: 4 }}>
          Teams / Outlook 링크 클릭 시 해당 앱으로 이동합니다
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
