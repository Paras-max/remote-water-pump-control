import pptxgen from "pptxgenjs";
import { existsSync } from "fs";
import { resolve } from "path";

const prs = new pptxgen();

prs.layout  = "LAYOUT_WIDE";
prs.title   = "AquaFlow — Smart Village Water Management System";
prs.author  = "AquaFlow Team";
prs.subject = "Project Proposal 2026";

const C = {
  navy:   "050D1F",
  dark:   "0A1628",
  card:   "0F1E38",
  blue:   "1A8CFF",
  cyan:   "00D4FF",
  teal:   "00B4A6",
  green:  "00E676",
  gold:   "FFD740",
  purple: "7C4DFF",
  red:    "FF5252",
  white:  "FFFFFF",
  muted:  "7F8FA6",
};

const BRAIN_DIR = "C:/Users/PARAS/.gemini/antigravity-ide/brain/734939fc-69ce-409e-a284-c17363b0e2ec";
const IMG = {
  hero:   `${BRAIN_DIR}/water_system_hero_1791090013590.jpg`,
  phase1: `${BRAIN_DIR}/phase1_pump_control_1791090030314.jpg`,
  phase2: `${BRAIN_DIR}/phase2_electronic_valves_1791090058888.jpg`,
  phase3: `${BRAIN_DIR}/phase3_ai_irrigation_1791090073114.jpg`,
};

function darkBg(s) { s.background = { color: C.navy }; }

function addTag(s, text, color, x, y) {
  s.addShape(prs.shapes.ROUNDED_RECTANGLE, { x, y, w: 3.5, h: 0.3, fill: { color: C.card }, line: { color, width: 1 } });
  s.addText(text, { x, y, w: 3.5, h: 0.3, fontSize: 8, bold: true, color, align: "center", valign: "middle", fontFace: "Segoe UI", charSpacing: 2 });
}

function glassCard(s, x, y, w, h, borderColor = C.cyan) {
  s.addShape(prs.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: C.card }, line: { color: borderColor, width: 1 }, rounding: 0.06 });
}

function addImg(s, path, x, y, w, h) {
  const winPath = path.replace(/\//g, "\\");
  if (existsSync(resolve(winPath))) {
    s.addImage({ path, x, y, w, h });
  } else {
    glassCard(s, x, y, w, h, C.muted);
    s.addText("[Image]", { x, y: y + h / 2 - 0.15, w, align: "center", color: C.muted, fontSize: 14 });
  }
}

function statBox(s, stat, label, color, x, y) {
  glassCard(s, x, y, 1.9, 1.05, color);
  s.addText(stat,  { x, y: y + 0.05, w: 1.9, fontSize: 28, bold: true, color, align: "center", fontFace: "Segoe UI" });
  s.addText(label, { x, y: y + 0.7,  w: 1.9, fontSize: 9,  color: C.muted, align: "center", fontFace: "Segoe UI" });
}

// ══ SLIDE 1 — TITLE ══
{
  const s = prs.addSlide();
  darkBg(s);
  s.addShape(prs.shapes.OVAL, { x: -1, y: -1, w: 5, h: 5, fill: { color: "001A4D", transparency: 40 }, line: { color: "001A4D" } });
  s.addShape(prs.shapes.OVAL, { x: 9,  y: 4,  w: 5, h: 5, fill: { color: "001F2B", transparency: 40 }, line: { color: "001F2B" } });

  addImg(s, IMG.hero, 3.5, 0.35, 6.3, 3.55);

  s.addText("Smart Village Water Management", {
    x: 0.5, y: 3.95, w: 12.3, fontSize: 36, bold: true, color: C.cyan,
    align: "center", fontFace: "Segoe UI",
  });
  s.addText("A Three-Phase IoT + AI Solution for Agricultural Irrigation", {
    x: 0.5, y: 4.7, w: 12.3, fontSize: 13, color: C.muted, align: "center", fontFace: "Segoe UI",
  });

  const badges = [
    { t: "Phase 1 — Remote Pump Control",  c: C.cyan  },
    { t: "Phase 2 — Smart Valve System",   c: C.green },
    { t: "Phase 3 — AI-Driven Irrigation", c: C.gold  },
  ];
  badges.forEach((b, i) => {
    const x = 0.9 + i * 4.0;
    s.addShape(prs.shapes.ROUNDED_RECTANGLE, { x, y: 5.35, w: 3.6, h: 0.38, fill: { color: C.card }, line: { color: b.c, width: 1 } });
    s.addText(b.t, { x, y: 5.35, w: 3.6, h: 0.38, fontSize: 10, bold: true, color: b.c, align: "center", valign: "middle", fontFace: "Segoe UI" });
  });

  s.addText("Confidential — Project Proposal 2026", {
    x: 8.0, y: 7.1, w: 5.0, fontSize: 8, color: C.muted, align: "right", fontFace: "Segoe UI",
  });
}

// ══ SLIDE 2 — PROBLEM STATEMENT ══
{
  const s = prs.addSlide();
  darkBg(s);
  s.addShape(prs.shapes.OVAL, { x: -1, y: 3, w: 5, h: 5, fill: { color: "14003D", transparency: 40 }, line: { color: "14003D" } });

  addTag(s, "🎯  PROBLEM STATEMENT", C.purple, 0.4, 0.35);
  s.addText("The Irrigation Challenge in Rural Villages", {
    x: 0.4, y: 0.78, w: 12.5, fontSize: 28, bold: true, color: C.white, fontFace: "Segoe UI",
  });
  s.addText("Traditional agricultural water systems are inefficient, uncontrolled, and wasteful — costing farmers time, money, and water.", {
    x: 0.4, y: 1.35, w: 12.5, fontSize: 12, color: C.muted, fontFace: "Segoe UI",
  });

  const problems = [
    { i: "🚶", t: "Physical Presence Required",  d: "Farmers must travel to wells to manually start/stop pumps — often at odd hours." },
    { i: "💧", t: "Water Wastage",               d: "Water is over-supplied to fields regardless of crop type or actual requirement." },
    { i: "⚡", t: "High Power Consumption",      d: "Motors run longer than necessary, driving up electricity costs." },
    { i: "🤝", t: "No Individual Control",       d: "All farmers share the same flow — one farmer's need affects all others." },
    { i: "🌾", t: "Crop-Blind Irrigation",       d: "No system accounts for different crop water needs across field types." },
    { i: "📵", t: "Zero Remote Access",          d: "No digital monitoring of pump status, runtime, or fault conditions." },
  ];

  problems.forEach((p, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.4 + col * 4.3, y = 1.85 + row * 2.45;
    glassCard(s, x, y, 4.1, 2.2, C.purple);
    s.addText(p.i,  { x, y: y + 0.2,  w: 4.1, fontSize: 26, align: "center" });
    s.addText(p.t,  { x: x + 0.15, y: y + 0.82, w: 3.8, fontSize: 12, bold: true, color: C.white, align: "center", fontFace: "Segoe UI" });
    s.addText(p.d,  { x: x + 0.2,  y: y + 1.18, w: 3.7, fontSize: 10, color: C.muted, align: "center", fontFace: "Segoe UI", wrap: true });
  });
}

// ══ SLIDE 3 — ROADMAP ══
{
  const s = prs.addSlide();
  darkBg(s);
  s.addShape(prs.shapes.OVAL, { x: 9, y: -1, w: 5, h: 5, fill: { color: "002020", transparency: 40 }, line: { color: "002020" } });

  addTag(s, "🗺️  PROJECT ROADMAP", C.cyan, 0.4, 0.35);
  s.addText("Three-Phase Implementation Plan", {
    x: 0.4, y: 0.78, w: 12.5, fontSize: 28, bold: true, color: C.white, fontFace: "Segoe UI",
  });
  s.addText("A structured, scalable approach — each phase builds on the previous, delivering increasing value.", {
    x: 0.4, y: 1.35, w: 12.5, fontSize: 12, color: C.muted, fontFace: "Segoe UI",
  });

  const phases = [
    { n: "1", c: C.cyan,  t: "Remote Pump Control",     d: "IoT-enabled 4G remote control of two well motors. Real-time status, emergency shutdown, and current sensing." },
    { n: "2", c: C.green, t: "Smart Valve Distribution", d: "Electronic solenoid valves on each farmer's branch pipe. Per-farmer individual water control via app." },
    { n: "3", c: C.gold,  t: "AI Precision Irrigation",  d: "Crop-aware AI formula computes exact water volume per acre. Automated irrigation — zero waste, max yield." },
  ];
  phases.forEach((p, i) => {
    const x = 0.5 + i * 4.3;
    s.addShape(prs.shapes.OVAL, { x: x + 1.55, y: 1.85, w: 0.85, h: 0.85, fill: { color: C.navy }, line: { color: p.c, width: 2 } });
    s.addText(p.n, { x: x + 1.55, y: 1.87, w: 0.85, fontSize: 20, bold: true, color: p.c, align: "center", fontFace: "Segoe UI" });
    if (i < 2) {
      s.addShape(prs.shapes.LINE, { x: x + 2.4, y: 2.28, w: 2.0, h: 0, line: { color: C.muted, width: 1 } });
    }
    glassCard(s, x, 2.9, 4.0, 2.65, p.c);
    s.addText(p.t, { x: x + 0.15, y: 3.05, w: 3.7, fontSize: 14, bold: true, color: p.c, fontFace: "Segoe UI" });
    s.addText(p.d, { x: x + 0.15, y: 3.45, w: 3.7, fontSize: 11, color: "B0C4DE", fontFace: "Segoe UI", wrap: true });
  });

  // Arch flow bar
  glassCard(s, 0.4, 5.8, 12.5, 1.3, C.muted);
  s.addText("SYSTEM ARCHITECTURE FLOW", { x: 0.4, y: 5.88, w: 12.5, fontSize: 8, bold: true, color: C.muted, align: "center", charSpacing: 2 });
  const nodes = [
    { l: "📱 Mobile App",      s2: "Farmer/Admin",    c: C.cyan   },
    { l: "☁️ Firebase Cloud", s2: "Real-time DB",    c: C.blue   },
    { l: "📡 4G Network",     s2: "Jio Dongle",      c: C.purple },
    { l: "🔧 ESP8266/ESP32",  s2: "Edge Controller", c: C.green  },
    { l: "⚙️ Motor + Valves",s2: "Field Hardware",  c: C.gold   },
  ];
  nodes.forEach((n, i) => {
    const x = 0.9 + i * 2.5;
    s.addShape(prs.shapes.ROUNDED_RECTANGLE, { x, y: 6.1, w: 2.1, h: 0.48, fill: { color: C.navy }, line: { color: n.c, width: 1 } });
    s.addText(n.l,  { x, y: 6.12, w: 2.1, fontSize: 9,  bold: true, color: n.c, align: "center", fontFace: "Segoe UI" });
    s.addText(n.s2, { x, y: 6.43, w: 2.1, fontSize: 8,  color: C.muted, align: "center", fontFace: "Segoe UI" });
    if (i < 4) {
      s.addText("→", { x: x + 2.1, y: 6.22, w: 0.4, fontSize: 13, color: C.muted, align: "center" });
    }
  });
}

// ══ SLIDE 4 — PHASE 1 ══
{
  const s = prs.addSlide();
  darkBg(s);
  s.addShape(prs.shapes.OVAL, { x: -1, y: -1, w: 5, h: 5, fill: { color: "001540", transparency: 40 }, line: { color: "001540" } });
  s.addShape(prs.shapes.LINE, { x: 6.7, y: 0.35, w: 0, h: 6.8, line: { color: C.muted, width: 0.5, dashType: "dash" } });

  addTag(s, "⚡  PHASE 1", C.cyan, 0.4, 0.35);
  s.addText("Remote Pump\nControl System", { x: 0.4, y: 0.78, w: 6.1, fontSize: 26, bold: true, color: C.cyan, fontFace: "Segoe UI" });
  s.addText("Two wells in the village, each fitted with an electric motor pump. Farmers start and stop motors remotely via our web app — from anywhere, via 4G.", {
    x: 0.4, y: 1.65, w: 6.1, fontSize: 11, color: C.muted, fontFace: "Segoe UI", wrap: true,
  });

  const feats = [
    { i: "🪣", t: "2 Village Wells",            d: "Each with a dedicated submersible motor distributing water through the main pipe." },
    { i: "📱", t: "Remote ON/OFF Control",       d: "Control motors via web/mobile app over 4G — no physical presence at the well." },
    { i: "⏱️", t: "Real-Time Runtime Monitor", d: "Live HH:MM:SS stopwatch tracks exactly how long each motor is running." },
    { i: "🚨", t: "Emergency Shutdown",          d: "One-tap emergency OFF immediately de-energises the motor contactor." },
    { i: "⚡", t: "ACS712 Current Sensing",      d: "Detects dry-run faults and hardware failures automatically." },
    { i: "💾", t: "Session History & Export",    d: "Every pump cycle logged with start/end time, duration, and average current." },
  ];
  feats.forEach((f, i) => {
    const y = 2.35 + i * 0.8;
    s.addText(`${f.i}  ${f.t}`, { x: 0.4, y, w: 6.1, fontSize: 11, bold: true, color: C.white, fontFace: "Segoe UI" });
    s.addText(f.d, { x: 0.7, y: y + 0.27, w: 5.8, fontSize: 10, color: C.muted, fontFace: "Segoe UI", wrap: true });
  });

  addImg(s, IMG.phase1, 6.9, 0.35, 6.1, 3.6);
  statBox(s, "2",    "Wells Covered",  C.cyan,  6.9,  4.1);
  statBox(s, "4G",   "Remote Access",  C.green, 8.85, 4.1);
  statBox(s, "24/7", "Monitoring",     C.gold,  10.8, 4.1);

  glassCard(s, 6.9, 5.35, 6.1, 1.85, C.muted);
  s.addText("KEY HARDWARE", { x: 7.0, y: 5.45, w: 5.9, fontSize: 8, bold: true, color: C.muted, charSpacing: 2 });
  const hw = ["NodeMCU ESP8266  ·  5V Relay Module  ·  AC Contactor", "ACS712 Current Sensor  ·  Jio 4G Dongle  ·  Firebase RTDB"];
  hw.forEach((h, i) => {
    s.addText(h, { x: 7.0, y: 5.75 + i * 0.4, w: 5.9, fontSize: 10, color: C.cyan, fontFace: "Segoe UI" });
  });
}

// ══ SLIDE 5 — PHASE 1 TECH ══
{
  const s = prs.addSlide();
  darkBg(s);

  addTag(s, "🔧  PHASE 1 — TECHNOLOGY STACK", C.cyan, 0.4, 0.35);
  s.addText("Under the Hood", { x: 0.4, y: 0.78, w: 12.5, fontSize: 28, bold: true, color: C.white, fontFace: "Segoe UI" });
  s.addText("Industrial-grade components, cloud-native architecture, zero compromise on reliability.", {
    x: 0.4, y: 1.35, w: 12.5, fontSize: 12, color: C.muted, fontFace: "Segoe UI",
  });

  const techs = [
    { i: "🔬", t: "NodeMCU ESP8266",        d: "Wi-Fi edge controller. Controls relay, reads ACS712, syncs Firebase every 10s." },
    { i: "🔁", t: "5V Relay + AC Contactor", d: "Optocoupled relay drives AC contactor to switch motor safely at mains voltage." },
    { i: "⚡", t: "ACS712 Sensor",           d: "Hall-effect current sensor. Detects dry-run and hardware faults automatically." },
    { i: "📡", t: "Jio 4G Dongle",           d: "Cellular internet hotspot providing reliable connectivity in remote rural areas." },
    { i: "☁️", t: "Firebase RTDB",           d: "Google Cloud Realtime DB. Command queue & heartbeat with <200ms latency." },
    { i: "⚛️", t: "React + TypeScript",      d: "Mobile-responsive dashboard with live telemetry, stopwatch & session history." },
    { i: "🌐", t: "Vercel Deployment",        d: "Global CDN. Accessible from any phone browser — just a URL, no install." },
    { i: "🔐", t: "Firebase Auth",            d: "Email/password auth ensures only authorised operators can control pumps." },
  ];
  techs.forEach((t, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 0.4 + col * 3.25, y = 1.9 + row * 2.35;
    glassCard(s, x, y, 3.05, 2.2, C.cyan);
    s.addText(t.i, { x, y: y + 0.18, w: 3.05, fontSize: 24, align: "center" });
    s.addText(t.t, { x: x + 0.1, y: y + 0.72, w: 2.85, fontSize: 11, bold: true, color: C.white, align: "center", fontFace: "Segoe UI" });
    s.addText(t.d, { x: x + 0.1, y: y + 1.1,  w: 2.85, fontSize: 9.5, color: C.muted, align: "center", fontFace: "Segoe UI", wrap: true });
  });

  glassCard(s, 0.4, 6.55, 12.5, 0.72, C.muted);
  const arch = [
    { l: "React App (Vercel)", c: C.cyan },
    { l: "⇄  Firebase RTDB",  c: C.blue },
    { l: "⇄  4G Hotspot",     c: C.purple },
    { l: "⇄  ESP8266",        c: C.green },
    { l: "→  Relay → Motor",  c: C.gold },
  ];
  arch.forEach((a, i) => {
    s.addText(a.l, { x: 0.55 + i * 2.5, y: 6.76, w: 2.4, fontSize: 10, bold: true, color: a.c, align: "center", fontFace: "Segoe UI" });
  });
}

// ══ SLIDE 6 — PHASE 2 ══
{
  const s = prs.addSlide();
  darkBg(s);
  s.addShape(prs.shapes.OVAL, { x: 9, y: -1, w: 5, h: 5, fill: { color: "002010", transparency: 40 }, line: { color: "002010" } });
  s.addShape(prs.shapes.LINE, { x: 6.7, y: 0.35, w: 0, h: 6.8, line: { color: C.muted, width: 0.5, dashType: "dash" } });

  addTag(s, "🚰  PHASE 2", C.green, 0.4, 0.35);
  s.addText("Smart Electronic\nValve Distribution", { x: 0.4, y: 0.78, w: 6.1, fontSize: 26, bold: true, color: C.green, fontFace: "Segoe UI" });
  s.addText("After the motor sends water through the main pipe, it branches into individual pipes for each farmer's field. Each branch has an electronic solenoid valve.", {
    x: 0.4, y: 1.7, w: 6.1, fontSize: 11, color: C.muted, fontFace: "Segoe UI", wrap: true,
  });

  const feats = [
    { i: "🔀", t: "Branched Pipeline",         d: "Main supply splits into N individual farmer pipes, each independently controlled." },
    { i: "🔌", t: "Solenoid Valves",            d: "Electronic normally-closed valves. Fail-safe — no power means no flow." },
    { i: "📱", t: "Per-Farmer App Toggle",      d: "If a farmer doesn't need water, they switch OFF — others receive water normally." },
    { i: "⚖️", t: "Fair Distribution",         d: "Closed valves redirect pressure to active pipes, improving flow for others." },
    { i: "📊", t: "Individual Usage Tracking",  d: "Valve history per farmer for accountability and water billing." },
  ];
  feats.forEach((f, i) => {
    const y = 2.55 + i * 0.85;
    s.addText(`${f.i}  ${f.t}`, { x: 0.4, y, w: 6.1, fontSize: 11, bold: true, color: C.white, fontFace: "Segoe UI" });
    s.addText(f.d, { x: 0.7, y: y + 0.27, w: 5.8, fontSize: 10, color: C.muted, fontFace: "Segoe UI", wrap: true });
  });

  addImg(s, IMG.phase2, 6.9, 0.35, 6.1, 3.5);

  glassCard(s, 6.9, 4.05, 6.1, 3.15, C.green);
  s.addText("VALVE CONTROL PER FARMER", { x: 6.9, y: 4.15, w: 6.1, fontSize: 8, bold: true, color: C.muted, align: "center", charSpacing: 2 });

  const farmers = [
    { n: "Farmer A — Field 1",  c: "🌾 Rice Paddy · 2 Acres",    open: true  },
    { n: "Farmer B — Field 2",  c: "🌿 Vegetables · 1.5 Acres",  open: true  },
    { n: "Farmer C — Field 3",  c: "🌽 Maize · 3 Acres",         open: true  },
    { n: "Farmer D — Field 4",  c: "🌾 Wheat · 2.5 Acres",       open: false },
  ];
  farmers.forEach((f, i) => {
    const y = 4.5 + i * 0.68;
    s.addShape(prs.shapes.ROUNDED_RECTANGLE, { x: 7.0, y, w: 5.85, h: 0.58, fill: { color: C.navy }, line: { color: C.card, width: 1 } });
    s.addText(`👨‍🌾  ${f.n}`, { x: 7.1, y: y + 0.04, w: 3.8, fontSize: 11, bold: true, color: C.white, fontFace: "Segoe UI" });
    s.addText(f.c,          { x: 7.1, y: y + 0.3,  w: 3.8, fontSize: 9,  color: C.muted, fontFace: "Segoe UI" });
    const sc = f.open ? C.green : C.red;
    const st = f.open ? "✅ OPEN" : "🔴 CLOSED";
    s.addShape(prs.shapes.ROUNDED_RECTANGLE, { x: 11.0, y: y + 0.1, w: 0.7, h: 0.34, fill: { color: C.navy }, line: { color: sc, width: 1 } });
    s.addText(st, { x: 11.0, y: y + 0.1, w: 0.7, h: 0.34, fontSize: 7.5, bold: true, color: sc, align: "center", valign: "middle", fontFace: "Segoe UI" });
  });
}

// ══ SLIDE 7 — PHASE 3 ══
{
  const s = prs.addSlide();
  darkBg(s);
  s.addShape(prs.shapes.OVAL, { x: -1, y: -1, w: 5, h: 5, fill: { color: "2B1A00", transparency: 40 }, line: { color: "2B1A00" } });
  s.addShape(prs.shapes.LINE, { x: 6.7, y: 0.35, w: 0, h: 6.8, line: { color: C.muted, width: 0.5, dashType: "dash" } });

  addTag(s, "🤖  PHASE 3", C.gold, 0.4, 0.35);
  s.addText("AI-Powered Precision\nIrrigation", { x: 0.4, y: 0.78, w: 6.1, fontSize: 26, bold: true, color: C.gold, fontFace: "Segoe UI" });
  s.addText("Every crop type has a defined water requirement per acre. Our AI engine calculates the exact volume needed and delivers precisely that amount.", {
    x: 0.4, y: 1.7, w: 6.1, fontSize: 11, color: C.muted, fontFace: "Segoe UI", wrap: true,
  });

  glassCard(s, 0.4, 2.25, 6.1, 2.65, C.gold);
  s.addText("🧠  AI FORMULA LOGIC", { x: 0.55, y: 2.38, w: 5.85, fontSize: 11, bold: true, color: C.gold, fontFace: "Segoe UI" });
  const steps = [
    "1.  Farmer inputs crop type and field size (acres) via the app.",
    "2.  AI engine references crop-specific water consumption table (L/acre/day).",
    "3.  Calculates required valve open-duration based on measured flow rate.",
    "4.  Valve auto-closes exactly when the required water volume is delivered.",
  ];
  steps.forEach((st, i) => {
    s.addText(st, { x: 0.55, y: 2.78 + i * 0.48, w: 5.85, fontSize: 10.5, color: "B0C4DE", fontFace: "Segoe UI" });
  });

  addImg(s, IMG.phase3, 6.9, 0.35, 6.1, 3.5);

  glassCard(s, 6.9, 4.05, 6.1, 3.2, C.gold);
  s.addText("CROP WATER REQUIREMENT TABLE", { x: 6.9, y: 4.15, w: 6.1, fontSize: 8, bold: true, color: C.muted, align: "center", charSpacing: 2 });
  s.addText("Crop",            { x: 7.0,  y: 4.42, w: 2.1, fontSize: 9, bold: true, color: C.cyan, fontFace: "Segoe UI" });
  s.addText("L / Acre / Day",  { x: 9.1,  y: 4.42, w: 2.1, fontSize: 9, bold: true, color: C.cyan, fontFace: "Segoe UI" });
  s.addText("Volume",          { x: 11.2, y: 4.42, w: 1.5, fontSize: 9, bold: true, color: C.cyan, fontFace: "Segoe UI" });
  s.addShape(prs.shapes.LINE,  { x: 7.0, y: 4.64, w: 5.85, h: 0, line: { color: C.muted, width: 0.5 } });

  const crops = [
    { n: "🌾 Rice Paddy", w: "1,800 – 2,400 L", p: 95 },
    { n: "🎋 Sugarcane",  w: "1,500 – 2,000 L", p: 80 },
    { n: "🌾 Wheat",      w: "600 – 900 L",      p: 35 },
    { n: "🌽 Maize",      w: "500 – 800 L",      p: 30 },
    { n: "🥦 Vegetables", w: "400 – 700 L",      p: 25 },
  ];
  crops.forEach((c, i) => {
    const y = 4.74 + i * 0.48;
    s.addText(c.n, { x: 7.0,  y, w: 2.1, fontSize: 10, color: C.white, fontFace: "Segoe UI" });
    s.addText(c.w, { x: 9.1,  y, w: 2.1, fontSize: 10, color: "B0C4DE", fontFace: "Segoe UI" });
    const bw = (c.p / 100) * 1.35;
    s.addShape(prs.shapes.ROUNDED_RECTANGLE, { x: 11.2, y: y + 0.09, w: 1.35, h: 0.2, fill: { color: C.dark }, line: { color: C.dark } });
    s.addShape(prs.shapes.ROUNDED_RECTANGLE, { x: 11.2, y: y + 0.09, w: Math.max(bw, 0.05), h: 0.2, fill: { color: C.cyan }, line: { color: C.cyan } });
  });
}

// ══ SLIDE 8 — EXPECTED IMPACT ══
{
  const s = prs.addSlide();
  darkBg(s);
  s.addShape(prs.shapes.OVAL, { x: 4, y: -2, w: 7, h: 7, fill: { color: "002020", transparency: 40 }, line: { color: "002020" } });

  addTag(s, "✅  EXPECTED IMPACT", C.green, 0.4, 0.35);
  s.addText("Why This Project Matters", { x: 0.4, y: 0.78, w: 12.5, fontSize: 28, bold: true, color: C.white, fontFace: "Segoe UI" });
  s.addText("Measurable, real-world benefits for the village community, farmers, and the environment.", {
    x: 0.4, y: 1.35, w: 12.5, fontSize: 12, color: C.muted, fontFace: "Segoe UI",
  });

  const bens = [
    { s: "40%",  l: "💧 Water Savings",        d: "Precision AI eliminates over-watering, saving up to 40% vs. traditional flood irrigation.", c: C.cyan   },
    { s: "100%", l: "📱 Remote Access",         d: "Farmers control pumps and valves from home — no travel to the well required.",              c: C.green  },
    { s: "30%",  l: "⚡ Power Reduction",       d: "Motors run only as needed. AI shutoff reduces electricity bills significantly.",             c: C.gold   },
    { s: "4",    l: "🧑‍🌾 Farmers Empowered",  d: "Each farmer has independent real-time control — no more water conflicts or disputes.",       c: C.purple },
    { s: "24/7", l: "🌐 Uptime Monitoring",     d: "10-second heartbeat, fault detection, and session logging round the clock.",                  c: C.teal   },
    { s: "0",    l: "🚨 Manual Trips",          d: "Emergency shutdown, dry-run detection, and fault alerts eliminate site visits.",             c: C.red    },
  ];
  bens.forEach((b, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.4 + col * 4.25, y = 1.85 + row * 2.6;
    glassCard(s, x, y, 4.05, 2.4, b.c);
    s.addText(b.s, { x, y: y + 0.12, w: 4.05, fontSize: 38, bold: true, color: b.c, align: "center", fontFace: "Segoe UI" });
    s.addText(b.l, { x: x + 0.1, y: y + 1.05, w: 3.85, fontSize: 12, bold: true, color: C.white, fontFace: "Segoe UI" });
    s.addText(b.d, { x: x + 0.1, y: y + 1.42, w: 3.85, fontSize: 10, color: C.muted, fontFace: "Segoe UI", wrap: true });
  });
}

// ══ SLIDE 9 — CONCLUSION / CTA ══
{
  const s = prs.addSlide();
  darkBg(s);
  s.addShape(prs.shapes.OVAL, { x: -1, y: -1, w: 6, h: 6, fill: { color: "001540", transparency: 40 }, line: { color: "001540" } });
  s.addShape(prs.shapes.OVAL, { x: 9,  y: 3,  w: 5, h: 5, fill: { color: "001F2B", transparency: 40 }, line: { color: "001F2B" } });

  addTag(s, "🎯  PROJECT PROPOSAL", C.cyan, 4.0, 0.35);
  s.addText("Approve AquaFlow —\nTransform Village Agriculture", {
    x: 0.5, y: 0.75, w: 12.3, fontSize: 34, bold: true, color: C.cyan, align: "center", fontFace: "Segoe UI",
  });
  s.addText("A phased, low-risk, high-impact IoT + AI solution that brings digital transformation\nto agricultural water management in rural India.", {
    x: 0.5, y: 2.05, w: 12.3, fontSize: 13, color: C.muted, align: "center", fontFace: "Segoe UI",
  });

  const phases = [
    { p: "⚡ Phase 1 — Ready Now",  c: C.cyan,  d: "Hardware, firmware, and web app are already built and tested. Deployable immediately upon approval." },
    { p: "🚰 Phase 2 — 3 Months",  c: C.green, d: "Solenoid valve procurement, installation, and integration with Phase 1. Minimal extra infrastructure." },
    { p: "🤖 Phase 3 — 6 Months",  c: C.gold,  d: "AI model training with local crop data, flow sensor integration, and automated scheduling rollout." },
  ];
  phases.forEach((p, i) => {
    const x = 0.6 + i * 4.25;
    glassCard(s, x, 2.88, 4.0, 2.4, p.c);
    s.addText(p.p, { x: x + 0.15, y: 3.03, w: 3.7, fontSize: 13, bold: true, color: p.c, fontFace: "Segoe UI" });
    s.addText(p.d, { x: x + 0.15, y: 3.46, w: 3.7, fontSize: 10.5, color: "B0C4DE", fontFace: "Segoe UI", wrap: true });
  });

  s.addShape(prs.shapes.ROUNDED_RECTANGLE, { x: 4.3, y: 5.55, w: 4.7, h: 0.68, fill: { color: C.blue }, line: { color: C.cyan, width: 2 } });
  s.addText("💧  Approve the Project  →", {
    x: 4.3, y: 5.55, w: 4.7, h: 0.68, fontSize: 16, bold: true, color: C.white,
    align: "center", valign: "middle", fontFace: "Segoe UI",
  });

  s.addText("Built on AquaFlow 4G  ·  Firebase  ·  ESP8266/ESP32  ·  React  ·  AI Irrigation Engine", {
    x: 0.5, y: 6.78, w: 12.3, fontSize: 9, color: C.muted, align: "center", fontFace: "Segoe UI",
  });
}

// ══ SAVE ══
const OUT = "C:/Users/PARAS/Desktop/Water Pump Control System/AquaFlow_Presentation.pptx";
await prs.writeFile({ fileName: OUT });
console.log("\n✅  PowerPoint saved successfully!");
console.log("📁  " + OUT + "\n");
