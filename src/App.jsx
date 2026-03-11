import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, where, serverTimestamp, getDoc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as XLSX from "xlsx";

const firebaseConfig = {
  apiKey: "AIzaSyCT97uKh1pm7VtrX-E2UElaTiynGfKUxoI",
  authDomain: "cdz-pedidos.firebaseapp.com",
  projectId: "cdz-pedidos",
  storageBucket: "cdz-pedidos.firebasestorage.app",
  messagingSenderId: "278443646127",
  appId: "1:278443646127:web:613628c6555a6df76cc85a",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ─── Usuarios / Vendedores ──────────────────────────────────────────
const VENDEDORES = {
  "daranibar@crucedelzorro.com": "Daniel Aranibar",
  "ventas@crucedelzorro.com": "Camila Justiniano",
  "benjaminrodriguez@crucedelzorro.com": "Benjamin Rodriguez",
  "raquelmorales@crucedelzorro.com": "Raquel Morales",
  "claramalaga@crucedelzorro.com": "Clara Malaga",
  "jesussierra@crucedelzorro.com": "Jesus Sierra",
  "admin@crucedelzorro.com": "Admin",
};

// ─── Catálogo ───────────────────────────────────────────────────────
const LINEAS_PRODUCTO = ["Cruce del Zorro", "Gato Encerrado", "La Curiosa", "La Viuda Descalza", "Porfiado", "Blanco"];

const CATALOGO = {
  "Cruce del Zorro":     [{ codigo: "CDZ-B",   cepa: "Blend" }, { codigo: "CDZ-P",   cepa: "Pettit Verdot" }],
  "Gato Encerrado":      [{ codigo: "GE-3en1", cepa: "Theepack" }],
  "La Curiosa":          [{ codigo: "LC-T",    cepa: "Tannat" }, { codigo: "LC-B",  cepa: "Blend" }, { codigo: "LC-M", cepa: "Malbec" }, { codigo: "LC-TRI", cepa: "Trivarietal" }, { codigo: "LC-C", cepa: "Cabernet Sauvignon" }],
  "La Viuda Descalza":   [{ codigo: "LVD",     cepa: "LVD" }, { codigo: "LVD-H",  cepa: "LVD Húngara" }, { codigo: "LVD-R", cepa: "LVD Reposada" }],
  "Porfiado":            [{ codigo: "PORF-B",  cepa: "Blend" }, { codigo: "PORF-CF", cepa: "Cabernet Franc" }, { codigo: "PORF-T", cepa: "Tannat" }],
  "Blanco":              [{ codigo: "VB-2en1", cepa: "2 en 1" }, { codigo: "BLANC",  cepa: "Blanc di Blancs" }],
};

const PRODUCTOS = Object.entries(CATALOGO).flatMap(([linea, prods]) =>
  prods.map(p => ({ codigo: p.codigo, nombre: `${linea} - ${p.cepa}`, linea, cepa: p.cepa }))
);

const CANALES = ["DTC", "Distribuidor", "Licorería", "Tienda", "Mayorista", "BAJAS"];
const TIPOS_BAJA = ["Bonificación", "Muestra", "Degustación"];
const FORMAS_PAGO = ["QR", "Efectivo", "Transferencia", "Tarjeta"];
const ESTADOS_COBRO = ["Pago Realizado", "Por Cobrar", "Al Crédito"];
const DIAS_CREDITO = ["10 días", "15 días", "20 días", "30 días", "45 días", "60 días"];

const LINEA_VACIA = { linea: "", codigo: "", cantidad: 1, precio: "" };

// ─── Colores ────────────────────────────────────────────────────────
const C = {
  bg: "#0a0a0a",
  card: "#141414",
  cardBorder: "#2a2a2a",
  gold: "#C8962E",
  goldLight: "#e0b44a",
  goldDim: "rgba(200,150,46,0.15)",
  text: "#f0ead6",
  textMuted: "#7a6a55",
  textSub: "#b0a090",
  danger: "#dc3545",
  success: "#28a745",
  info: "#3a8fd4",
  red: "#8B1A1A",
};

// ─── Estilos base ───────────────────────────────────────────────────
const inp = {
  width: "100%", padding: "12px 14px", borderRadius: 10,
  border: `1px solid #333`, background: "#1a1a1a",
  color: C.text, fontSize: 15, outline: "none", boxSizing: "border-box",
  WebkitAppearance: "none",
};
const sel = { ...inp };
const lbl = { display: "block", fontSize: 11, color: C.textMuted, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 };
const btn = (v = "primary") => ({
  padding: "13px 24px", borderRadius: 10, border: "none", cursor: "pointer",
  fontSize: 15, fontWeight: 700, letterSpacing: 0.3, transition: "all 0.18s",
  ...(v === "primary" ? { background: `linear-gradient(135deg, #8B4513, ${C.gold})`, color: "#fff", boxShadow: "0 4px 16px rgba(139,69,19,0.35)" }
    : v === "ghost" ? { background: "transparent", color: C.textMuted, border: `1px solid #333` }
    : v === "success" ? { background: "rgba(40,167,69,0.15)", color: C.success, border: `1px solid ${C.success}` }
    : v === "danger" ? { background: "rgba(220,53,69,0.12)", color: C.danger, border: `1px solid ${C.danger}` }
    : { background: C.goldDim, color: C.gold, border: `1px solid ${C.gold}` }),
});
const card = { background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: 20, marginBottom: 18 };
const section = { fontSize: 13, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid #222` };

// ─── LOGIN ──────────────────────────────────────────────────────────
function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    getRedirectResult(auth).catch(() => {});
  }, []);

  const doLogin = async () => {
    setErr(""); setLoading(true);
    try { await signInWithEmailAndPassword(auth, email, pass); }
    catch { setErr("Email o contraseña incorrectos."); }
    finally { setLoading(false); }
  };

  const doGoogleLogin = async () => {
    setErr(""); setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    }
    catch (e) {
      if (e.code === "auth/popup-blocked" || e.code === "auth/cancelled-popup-request") {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch { setErr("Error al iniciar sesión con Google."); }
      } else if (e.code === "auth/popup-closed-by-user") {
      } else if (e.code === "auth/account-exists-with-different-credential") {
        setErr("Ya existe una cuenta con este email usando otro método de inicio de sesión.");
      } else {
        setErr("Error al iniciar sesión con Google.");
      }
    }
    finally { setGoogleLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(ellipse at center, #1a0800 0%, ${C.bg} 70%)` }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ ...card, width: "min(90vw,380px)", padding: 40, textAlign: "center" }}>
        <img src="/logo-cdz.png" alt="CDZ" style={{ width: 64, height: 64, marginBottom: 6, filter: "invert(1)", mixBlendMode: "screen" }} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, color: C.gold, fontWeight: 700, letterSpacing: 2 }}>CDZ</div>
        <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 4, textTransform: "uppercase", marginBottom: 32 }}>Cruce del Zorro</div>
        <div style={{ marginBottom: 14, textAlign: "left" }}>
          <label style={lbl}>Email</label>
          <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@crucedelzorro.com" onKeyDown={e => e.key === "Enter" && doLogin()} />
        </div>
        <div style={{ marginBottom: 24, textAlign: "left" }}>
          <label style={lbl}>Contraseña</label>
          <input style={inp} type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} />
        </div>
        {err && <div style={{ color: C.danger, fontSize: 13, marginBottom: 16, padding: "10px 14px", background: "rgba(220,53,69,0.08)", borderRadius: 8, border: `1px solid rgba(220,53,69,0.25)` }}>{err}</div>}
        <button style={{ ...btn("primary"), width: "100%", padding: 15, fontSize: 16 }} onClick={doLogin} disabled={loading || googleLoading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#333" }} />
          <span style={{ fontSize: 12, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>o</span>
          <div style={{ flex: 1, height: 1, background: "#333" }} />
        </div>
        <button
          style={{
            width: "100%", padding: 14, borderRadius: 10, border: "1px solid #333",
            background: "#1a1a1a", color: C.text, fontSize: 15, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "all 0.18s",
          }}
          onClick={doGoogleLogin}
          disabled={loading || googleLoading}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {googleLoading ? "Ingresando..." : "Continuar con Google"}
        </button>
      </div>
    </div>
  );
}

// ─── FORMULARIO VENDEDOR ────────────────────────────────────────────
function FormVendedor({ user, vendedorNombre }) {
  const empty = () => ({
    nombreCliente: "", telefono: "", nit: "", razonSocial: "", canal: "", tipoBaja: "",
    lineas: [{ ...LINEA_VACIA }, { ...LINEA_VACIA }, { ...LINEA_VACIA }, { ...LINEA_VACIA }, { ...LINEA_VACIA }, { ...LINEA_VACIA }],
    formaPago: "", estadoCobro: "", diasCredito: "",
    direccion: "", entregarHoy: false, costoEnvio: "",
    diaEntrega: "", horarioEntrega: "",
    notas: "", imagenes: [],
  });

  const [vista, setVista] = useState("form");
  const [form, setForm] = useState(empty());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updateLinea = (i, k, v) => {
    const ls = form.lineas.map((l, idx) => {
      if (idx !== i) return l;
      if (k === "linea") return { ...l, linea: v, codigo: "" };
      return { ...l, [k]: v };
    });
    setForm(f => ({ ...f, lineas: ls }));
  };

  const subtotalLinea = (l) => {
    const c = parseInt(l.cantidad) || 0;
    const p = parseFloat(l.precio) || 0;
    return c * p;
  };

  const subtotalProductos = form.lineas.reduce((s, l) => s + subtotalLinea(l), 0);
  const costoEnvioNum = parseFloat(form.costoEnvio) || 0;
  const total = subtotalProductos + costoEnvioNum;

  const handleImages = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(async (file) => {
        const r = ref(storage, `comprobantes/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        return getDownloadURL(r);
      }));
      setForm(f => ({ ...f, imagenes: [...f.imagenes, ...urls] }));
    } catch (err) { alert("Error al subir imagen: " + err.message); }
    finally { setUploading(false); }
  };

  const handleSubmit = async () => {
    if (!form.nombreCliente.trim()) return alert("Ingresá el nombre del cliente.");
    const lineasValidas = form.lineas.filter(l => l.codigo && (parseInt(l.cantidad) > 0) && l.precio !== "");
    if (!lineasValidas.length) return alert("Agregá al menos un producto.");
    if (form.canal === "BAJAS") {
      if (!form.tipoBaja) return alert("Seleccioná el tipo de baja de producto.");
    } else {
      if (!form.formaPago) return alert("Seleccioná la forma de pago.");
      if (!form.estadoCobro) return alert("Seleccioná el estado de cobro.");
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "pedidos"), {
        vendedorEmail: user.email,
        vendedorNombre,
        nombreCliente: form.nombreCliente,
        telefono: form.telefono,
        nit: form.nit,
        razonSocial: form.razonSocial,
        canal: form.canal,
        tipoBaja: form.canal === "BAJAS" ? form.tipoBaja : "",
        lineas: lineasValidas,
        subtotalProductos,
        costoEnvio: costoEnvioNum,
        total,
        formaPago: form.canal === "BAJAS" ? "" : form.formaPago,
        estadoCobro: form.canal === "BAJAS" ? "" : form.estadoCobro,
        diasCredito: form.estadoCobro === "Al Crédito" && form.canal !== "BAJAS" ? form.diasCredito : "",
        direccion: form.entregarHoy ? "ENTREGAR HOY" : form.direccion,
        entregarHoy: form.entregarHoy,
        diaEntrega: form.diaEntrega,
        horarioEntrega: form.horarioEntrega,
        notas: form.notas,
        imagenes: form.imagenes,
        // estados que admin gestiona
        entregado: false,
        nroFactura: "",
        estadoAdmin: "Pendiente",
        createdAt: serverTimestamp(),
      });
      setSaved(true);
      setForm(empty());
      setTimeout(() => setSaved(false), 4000);
    } catch (e) { alert("Error al guardar: " + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a0800, #2a1200)", borderBottom: `1px solid #3a2010`, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo-cdz.png" alt="CDZ" style={{ width: 28, height: 28, filter: "invert(1)", mixBlendMode: "screen" }} />
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", color: C.gold, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>CDZ</div>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 2 }}>PEDIDOS</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{vendedorNombre}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>Vendedor</div>
          </div>
          <button style={{ ...btn("ghost"), padding: "6px 12px", fontSize: 12 }} onClick={() => signOut(auth)}>Salir</button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 0, background: "#111", borderBottom: `1px solid #2a2a2a` }}>
        {[
          { key: "form", label: "📝 Nuevo Pedido" },
          { key: "panel", label: "📋 Mis Pedidos" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setVista(t.key)}
            style={{
              padding: "12px 28px", fontSize: 14, fontWeight: vista === t.key ? 700 : 400,
              color: vista === t.key ? C.gold : C.textMuted, background: "transparent",
              border: "none", borderBottom: vista === t.key ? `2px solid ${C.gold}` : "2px solid transparent",
              cursor: "pointer", transition: "all 0.2s", letterSpacing: 0.5,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {vista === "form" && (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px 40px" }}>

        {saved && (
          <div style={{ background: "rgba(40,167,69,0.12)", border: `1px solid ${C.success}`, borderRadius: 12, padding: 18, marginBottom: 20, textAlign: "center", color: C.success, fontWeight: 700, fontSize: 16 }}>
            ✅ ¡Pedido enviado correctamente!
          </div>
        )}

        {/* CLIENTE */}
        <div style={card}>
          <div style={section}>👤 Cliente</div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Nombre *</label>
            <input style={inp} value={form.nombreCliente} onChange={e => set("nombreCliente", e.target.value)} placeholder="Nombre del cliente" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Teléfono</label>
              <input style={inp} type="tel" value={form.telefono} onChange={e => set("telefono", e.target.value)} placeholder="+591 ..." />
            </div>
            <div>
              <label style={lbl}>NIT</label>
              <input style={inp} value={form.nit} onChange={e => set("nit", e.target.value)} placeholder="NIT" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Razón Social</label>
            <input style={inp} value={form.razonSocial} onChange={e => set("razonSocial", e.target.value)} placeholder="Razón social" />
          </div>
          <div>
            <label style={lbl}>Canal *</label>
            <select style={sel} value={form.canal} onChange={e => {
              const val = e.target.value;
              set("canal", val);
              if (val === "BAJAS") {
                setForm(f => ({ ...f, canal: val, formaPago: "", estadoCobro: "", diasCredito: "" }));
              } else {
                setForm(f => ({ ...f, canal: val, tipoBaja: "" }));
              }
            }}>
              <option value="">— Seleccionar canal —</option>
              {CANALES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {form.canal === "BAJAS" && (
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Tipo de Baja de Producto *</label>
              <select style={sel} value={form.tipoBaja} onChange={e => set("tipoBaja", e.target.value)}>
                <option value="">— Seleccionar tipo de baja —</option>
                {TIPOS_BAJA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* PRODUCTOS */}
        <div style={card}>
          <div style={section}>🍾 Productos</div>
          {/* Headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 55px 80px 70px", gap: 6, marginBottom: 8 }}>
            {["Línea", "Cepa/Prod.", "Cant.", "Precio", "Sub"].map(h => (
              <div key={h} style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{h}</div>
            ))}
          </div>
          {form.lineas.map((l, i) => {
            const productosFiltrados = l.linea ? (CATALOGO[l.linea] || []) : [];
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 55px 80px 70px", gap: 6, marginBottom: 10, alignItems: "center" }}>
                <select style={{ ...sel, fontSize: 12, padding: "10px 6px" }} value={l.linea || ""} onChange={e => updateLinea(i, "linea", e.target.value)}>
                  <option value="">— Línea —</option>
                  {LINEAS_PRODUCTO.map(lp => <option key={lp} value={lp}>{lp}</option>)}
                </select>
                <select style={{ ...sel, fontSize: 12, padding: "10px 6px", opacity: l.linea ? 1 : 0.4 }} value={l.codigo} onChange={e => updateLinea(i, "codigo", e.target.value)} disabled={!l.linea}>
                  <option value="">— Cepa —</option>
                  {productosFiltrados.map(p => <option key={p.codigo} value={p.codigo}>{p.cepa}</option>)}
                </select>
                <input style={{ ...inp, padding: "10px 6px", textAlign: "center", fontSize: 13 }} type="number" min={1} max={999} value={l.cantidad} onChange={e => updateLinea(i, "cantidad", e.target.value)} />
                <input style={{ ...inp, padding: "10px 6px", fontSize: 13 }} type="number" value={l.precio} onChange={e => updateLinea(i, "precio", e.target.value)} placeholder="0" />
                <div style={{ color: subtotalLinea(l) > 0 ? C.gold : C.textMuted, fontWeight: 700, fontSize: 13, textAlign: "right" }}>
                  {subtotalLinea(l) > 0 ? `$${subtotalLinea(l).toLocaleString()}` : "—"}
                </div>
              </div>
            );
          })}
          <div style={{ borderTop: `1px solid #222`, paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.textMuted, fontSize: 13 }}>Subtotal productos</span>
            <span style={{ color: C.gold, fontWeight: 700, fontSize: 18 }}>${subtotalProductos.toLocaleString()}</span>
          </div>
        </div>

        {/* ENTREGA Y PAGO */}
        <div style={card}>
          <div style={section}>💳 Entrega y Pago</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Forma de Pago {form.canal !== "BAJAS" ? "*" : ""}</label>
              <select style={{ ...sel, opacity: form.canal === "BAJAS" ? 0.4 : 1 }} value={form.formaPago} onChange={e => set("formaPago", e.target.value)} disabled={form.canal === "BAJAS"}>
                <option value="">— Seleccionar —</option>
                {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Estado de Cobro {form.canal !== "BAJAS" ? "*" : ""}</label>
              <select style={{ ...sel, opacity: form.canal === "BAJAS" ? 0.4 : 1 }} value={form.estadoCobro} onChange={e => set("estadoCobro", e.target.value)} disabled={form.canal === "BAJAS"}>
                <option value="">— Seleccionar —</option>
                {ESTADOS_COBRO.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          {form.estadoCobro === "Al Crédito" && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Días de Crédito</label>
              <select style={sel} value={form.diasCredito} onChange={e => set("diasCredito", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {DIAS_CREDITO.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Día de Entrega</label>
              <input style={inp} type="date" value={form.diaEntrega} onChange={e => set("diaEntrega", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Horario de Entrega</label>
              <input style={inp} value={form.horarioEntrega} onChange={e => set("horarioEntrega", e.target.value)} placeholder="Ej: 9:00 a 12:00" />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Dirección de Entrega</label>
            <input style={{ ...inp, opacity: form.entregarHoy ? 0.4 : 1 }} value={form.direccion} onChange={e => set("direccion", e.target.value)} placeholder="Calle, número, referencia..." disabled={form.entregarHoy} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div
                onClick={() => set("entregarHoy", !form.entregarHoy)}
                style={{ width: 46, height: 26, borderRadius: 13, background: form.entregarHoy ? C.gold : "#333", transition: "all 0.2s", position: "relative", cursor: "pointer", flexShrink: 0 }}
              >
                <div style={{ position: "absolute", top: 3, left: form.entregarHoy ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />
              </div>
              <span style={{ fontSize: 14, color: form.entregarHoy ? C.gold : C.textMuted, fontWeight: form.entregarHoy ? 600 : 400 }}>📦 Entregar Hoy</span>
            </label>
          </div>

          <div style={{ marginBottom: 4 }}>
            <label style={lbl}>Costo de Envío</label>
            <input style={inp} type="number" value={form.costoEnvio} onChange={e => set("costoEnvio", e.target.value)} placeholder="0" />
          </div>
        </div>

        {/* TOTAL */}
        <div style={{ ...card, background: "linear-gradient(135deg, #1a0e00, #2a1800)", border: `1px solid ${C.gold}40`, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: costoEnvioNum > 0 ? 8 : 0 }}>
            <span style={{ color: C.textMuted, fontSize: 14 }}>Subtotal productos</span>
            <span style={{ color: C.textSub, fontSize: 15 }}>${subtotalProductos.toLocaleString()}</span>
          </div>
          {costoEnvioNum > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ color: C.textMuted, fontSize: 14 }}>Costo de envío</span>
              <span style={{ color: C.textSub, fontSize: 15 }}>${costoEnvioNum.toLocaleString()}</span>
            </div>
          )}
          <div style={{ borderTop: `1px solid ${C.gold}30`, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.text, fontSize: 16, fontWeight: 600 }}>TOTAL A PAGAR</span>
            <span style={{ color: C.gold, fontSize: 32, fontWeight: 800, fontFamily: "'Playfair Display', serif" }}>${total.toLocaleString()}</span>
          </div>
        </div>

        {/* NOTAS E IMÁGENES */}
        <div style={card}>
          <div style={section}>📝 Notas e Imágenes</div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Notas adicionales</label>
            <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={form.notas} onChange={e => set("notas", e.target.value)} placeholder="Instrucciones especiales, observaciones..." />
          </div>
          <div>
            <label style={lbl}>Imágenes / Comprobante</label>
            <div
              style={{ border: "2px dashed #333", borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer", color: C.textMuted }}
              onClick={() => fileRef.current.click()}
            >
              {uploading ? "⏳ Subiendo..." : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                  <div style={{ fontSize: 13 }}>Tocá para subir foto</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>JPG, PNG</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImages} />
            {form.imagenes.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {form.imagenes.map((url, i) => (
                  <img key={i} src={url} alt="" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, border: `1px solid #333` }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTÓN ENVIAR */}
        <button style={{ ...btn("primary"), width: "100%", padding: 18, fontSize: 17, borderRadius: 12 }} onClick={handleSubmit} disabled={saving}>
          {saving ? "Enviando pedido..." : "✅ Enviar Pedido"}
        </button>

      </div>
      )}

      {vista === "panel" && (
        <PanelVendedor user={user} vendedorNombre={vendedorNombre} />
      )}
    </div>
  );
}

// ─── PANEL VENDEDOR (Revisión de pedidos) ───────────────────────────
function PanelVendedor({ user, vendedorNombre }) {
  const [pedidos, setPedidos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroEntregado, setFiltroEntregado] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(null);
  const fotoEntregaRef = useRef();
  const pedidoFotoRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.vendedorEmail === user.email));
    });
  }, [user.email]);

  const update = async (id, data) => {
    await updateDoc(doc(db, "pedidos", id), { ...data, updatedAt: serverTimestamp() });
  };

  const filtrados = pedidos.filter(p => {
    const matchE = filtroEstado === "Todos" || p.estadoCobro === filtroEstado;
    const matchEnt = filtroEntregado === "Todos" || (filtroEntregado === "Entregado" ? p.entregado : !p.entregado);
    const matchB = !busqueda || p.nombreCliente?.toLowerCase().includes(busqueda.toLowerCase());
    return matchE && matchEnt && matchB;
  });

  const totalFiltrado = filtrados.reduce((s, p) => s + (p.total || 0), 0);

  const exportar = () => {
    const rows = filtrados.map(p => ({
      "Fecha": p.createdAt?.toDate?.()?.toLocaleDateString?.("es-BO") || "-",
      "Cliente": p.nombreCliente,
      "Teléfono": p.telefono || "",
      "NIT": p.nit || "",
      "Razón Social": p.razonSocial || "",
      "Canal": p.canal || "",
      "Tipo de Baja": p.tipoBaja || "",
      "Autorizar Baja": p.autorizarBaja || "",
      "Autorizar Crédito": p.autorizarCredito || "",
      "Días Crédito Admin": p.diasCreditoAdmin || "",
      "Productos": (p.lineas || []).map(l => `${l.codigo} x${l.cantidad} ($${l.precio})`).join(" | "),
      "Subtotal Prod.": p.subtotalProductos || 0,
      "Costo Envío": p.costoEnvio || 0,
      "Total": p.total || 0,
      "Forma de Pago": p.formaPago || "",
      "Estado Cobro": p.estadoCobro || "",
      "Días Crédito": p.diasCredito || "",
      "Dirección": p.direccion || "",
      "Día Entrega": p.diaEntrega || "",
      "Horario Entrega": p.horarioEntrega || "",
      "Entregar Hoy": p.entregarHoy ? "Sí" : "No",
      "Entregado": p.entregado ? "Sí" : "No",
      "Estado Admin": p.estadoAdmin || "",
      "Notas": p.notas || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mis Pedidos");
    XLSX.writeFile(wb, `CDZ_MisPedidos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const estadoBadge = (e) => {
    const map = {
      "Pago Realizado": { bg: "rgba(40,167,69,0.15)", color: "#28a745", border: "#28a745" },
      "Por Cobrar":     { bg: "rgba(255,193,7,0.15)",  color: "#ffc107", border: "#ffc107" },
      "Al Crédito":     { bg: "rgba(58,143,212,0.15)", color: "#3a8fd4", border: "#3a8fd4" },
    };
    const s = map[e] || { bg: "#222", color: C.textMuted, border: "#444" };
    return { padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` };
  };

  const marcarEntregado = async (p) => {
    if (p.entregado) return;
    if (!confirm("¿Confirmar que el pedido fue entregado? Esta acción no se puede deshacer.")) return;
    await update(p.id, { entregado: true });
  };

  const handleFotoEntrega = async (e) => {
    const files = Array.from(e.target.files);
    const inputEl = e.target;
    const pedidoId = pedidoFotoRef.current;
    if (!files.length || !pedidoId) return;
    setSubiendoFoto("uploading");
    try {
      const urls = [];
      for (const file of files) {
        const r = ref(storage, `comprobantes/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        urls.push(url);
      }
      const pedido = pedidos.find(p => p.id === pedidoId);
      const prev = pedido?.fotosEntrega || [];
      await update(pedidoId, { fotosEntrega: [...prev, ...urls] });
    } catch (err) { alert("Error al subir la foto: " + err.message); }
    finally { setSubiendoFoto(null); inputEl.value = ""; }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", color: C.gold, fontSize: 20, fontWeight: 700 }}>Mis Pedidos</div>
        <button style={{ ...btn("success"), padding: "9px 20px", fontSize: 13 }} onClick={exportar}>📥 Exportar Excel</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Pedidos", val: pedidos.length, icon: "📋" },
          { label: "Filtrados", val: filtrados.length, icon: "🔍" },
          { label: "Total Filtrado", val: `$${totalFiltrado.toLocaleString()}`, icon: "💰" },
          { label: "Entregados", val: pedidos.filter(p => p.entregado).length, icon: "✅" },
          { label: "Pendientes", val: pedidos.filter(p => !p.entregado).length, icon: "⏳" },
        ].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.gold, fontFamily: "'Playfair Display', serif" }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 180px" }}>
          <label style={lbl}>Buscar</label>
          <input style={inp} placeholder="Nombre del cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={lbl}>Estado Cobro</label>
          <select style={sel} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="Todos">Todos</option>
            {ESTADOS_COBRO.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={lbl}>Entrega</label>
          <select style={sel} value={filtroEntregado} onChange={e => setFiltroEntregado(e.target.value)}>
            <option value="Todos">Todos</option>
            <option value="Entregado">Entregado</option>
            <option value="Pendiente">Pendiente entrega</option>
          </select>
        </div>
      </div>

      {detalle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setDetalle(null)}>
          <div style={{ background: "#161616", border: `1px solid #333`, borderRadius: 16, padding: 28, width: "min(95vw,680px)", maxHeight: "90vh", overflowY: "auto" }}>
            {(() => {
              const p = detalle;
              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", color: C.gold, fontSize: 20, fontWeight: 700 }}>📋 Detalle del Pedido</div>
                    <button style={{ ...btn("ghost"), padding: "5px 12px" }} onClick={() => setDetalle(null)}>✕</button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    {[
                      ["Cliente", p.nombreCliente],
                      ["Teléfono", p.telefono || "—"],
                      ["Canal", p.canal || "—"],
                      ...(p.canal === "BAJAS" ? [["Tipo de Baja", p.tipoBaja || "—"], ["Autorizar Baja", p.autorizarBaja || "Pendiente"]] : []),
                      ["NIT", p.nit || "—"],
                      ["Razón Social", p.razonSocial || "—"],
                      ...(p.canal !== "BAJAS" ? [["Forma de Pago", p.formaPago || "—"],
                      ["Estado Cobro", p.estadoCobro + (p.diasCredito ? ` (${p.diasCredito})` : "")],
                      ...(p.estadoCobro === "Al Crédito" ? [["Aut. Crédito", (p.autorizarCredito || "Pendiente") + (p.diasCreditoAdmin ? ` (${p.diasCreditoAdmin})` : "")]] : [])] : []),
                      ["Dirección", p.direccion || "—"],
                      ["Día Entrega", p.diaEntrega || "—"],
                      ["Horario Entrega", p.horarioEntrega || "—"],
                      ["Estado Admin", p.estadoAdmin || "Pendiente"],
                      ["Fecha", p.createdAt?.toDate?.()?.toLocaleString?.("es-BO") || "—"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background: "#1a1a1a", borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{k}</div>
                        <div style={{ fontSize: 13, color: C.text }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
                    <thead>
                      <tr>
                        {["Código", "Producto", "Cant.", "Precio", "Subtotal"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid #2a2a2a`, color: C.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(p.lineas || []).map((l, i) => {
                        const prod = PRODUCTOS.find(x => x.codigo === l.codigo);
                        return (
                          <tr key={i}>
                            <td style={{ padding: "9px 10px", borderBottom: `1px solid #1a1a1a`, color: C.gold, fontWeight: 600 }}>{l.codigo}</td>
                            <td style={{ padding: "9px 10px", borderBottom: `1px solid #1a1a1a`, color: C.text }}>{prod?.nombre || l.codigo}</td>
                            <td style={{ padding: "9px 10px", borderBottom: `1px solid #1a1a1a`, color: C.textSub }}>{l.cantidad}</td>
                            <td style={{ padding: "9px 10px", borderBottom: `1px solid #1a1a1a`, color: C.textSub }}>${parseFloat(l.precio).toLocaleString()}</td>
                            <td style={{ padding: "9px 10px", borderBottom: `1px solid #1a1a1a`, color: C.gold, fontWeight: 700 }}>${(parseFloat(l.precio) * parseInt(l.cantidad)).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                      {p.costoEnvio > 0 && (
                        <tr>
                          <td colSpan={4} style={{ padding: "9px 10px", color: C.textMuted, textAlign: "right", fontSize: 12 }}>Costo de envío</td>
                          <td style={{ padding: "9px 10px", color: C.textSub, fontWeight: 600 }}>${p.costoEnvio.toLocaleString()}</td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={4} style={{ padding: "10px 10px", fontWeight: 700, color: C.textMuted, textAlign: "right", fontSize: 13 }}>TOTAL</td>
                        <td style={{ padding: "10px 10px", color: C.gold, fontWeight: 800, fontSize: 18 }}>${(p.total || 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>

                  {p.notas && <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 12, fontSize: 13, color: C.textSub, marginBottom: 16 }}><b style={{ color: C.gold }}>Notas:</b> {p.notas}</div>}

                  {(p.imagenes || []).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Imágenes / Comprobante</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {p.imagenes.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid #333` }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {(p.fotosEntrega || []).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: C.success, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>📷 Fotos de Entrega</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {p.fotosEntrega.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.success}` }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 14 }}>
          Mostrando <b style={{ color: C.gold }}>{filtrados.length}</b> de {pedidos.length} pedidos
        </div>
        {filtrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
            <img src="/logo-cdz.png" alt="CDZ" style={{ width: 52, height: 52, marginBottom: 12, filter: "invert(1)", mixBlendMode: "screen" }} />
            <div>No hay pedidos que mostrar</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Fecha", "Cliente", "Canal", "Productos", "Total", "Pago", "Estado Admin", "Factura", "Entregado", ""].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", borderBottom: `1px solid #2a2a2a`, color: C.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => (
                  <tr key={p.id} style={{ cursor: "pointer", borderBottom: `1px solid #1a1a1a` }}
                    onClick={() => setDetalle(p)}
                    onMouseEnter={e => e.currentTarget.style.background = "#1a1a1a"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "11px 12px", color: C.textMuted, whiteSpace: "nowrap", fontSize: 12 }}>{p.createdAt?.toDate?.()?.toLocaleDateString?.("es-BO") || "—"}</td>
                    <td style={{ padding: "11px 12px", color: C.text, fontWeight: 600 }}>{p.nombreCliente}</td>
                    <td style={{ padding: "11px 12px", color: C.textMuted, fontSize: 12 }}>{p.canal || "—"}</td>
                    <td style={{ padding: "11px 12px", color: C.textMuted, fontSize: 12 }}>{(p.lineas || []).length} línea(s)</td>
                    <td style={{ padding: "11px 12px", color: C.gold, fontWeight: 700, whiteSpace: "nowrap" }}>${(p.total || 0).toLocaleString()}</td>
                    <td style={{ padding: "11px 12px" }}><span style={estadoBadge(p.estadoCobro)}>{p.estadoCobro}</span></td>
                    <td style={{ padding: "11px 12px" }}>
                      <span style={{ fontSize: 11, color: p.estadoAdmin === "Completado" ? C.success : p.estadoAdmin === "Cancelado" ? C.danger : C.textMuted }}>
                        {p.estadoAdmin || "Pendiente"}
                      </span>
                    </td>
                    <td style={{ padding: "11px 12px", color: p.nroFactura ? C.gold : C.textMuted, fontSize: 12, fontWeight: p.nroFactura ? 600 : 400 }}>
                      {p.nroFactura || "—"}
                    </td>
                    <td style={{ padding: "11px 12px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      <div
                        onClick={() => marcarEntregado(p)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: p.entregado ? "default" : "pointer", padding: "4px 10px", borderRadius: 8, background: p.entregado ? "rgba(40,167,69,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${p.entregado ? C.success : "#333"}`, transition: "all 0.2s", opacity: p.entregado ? 0.8 : 1 }}
                      >
                        <span style={{ fontSize: 14 }}>{p.entregado ? "✅" : "⏳"}</span>
                        <span style={{ fontSize: 11, color: p.entregado ? C.success : C.textMuted, fontWeight: 600 }}>{p.entregado ? "Entregado" : "Marcar entregado"}</span>
                      </div>
                    </td>
                    <td style={{ padding: "11px 12px", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={{ ...btn("ghost"), padding: "5px 12px", fontSize: 12 }} onClick={() => setDetalle(p)}>👁 Ver</button>
                        <button
                          style={{
                            ...btn((p.fotosEntrega || []).length > 0 ? "success" : "ghost"),
                            padding: "5px 12px", fontSize: 12,
                          }}
                          disabled={subiendoFoto === "uploading"}
                          onClick={() => { pedidoFotoRef.current = p.id; setSubiendoFoto(p.id); fotoEntregaRef.current.click(); }}
                        >
                          {subiendoFoto === "uploading" ? "⏳" : "📷"} {(p.fotosEntrega || []).length > 0 ? `Foto (${(p.fotosEntrega || []).length})` : "Subir foto"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <input ref={fotoEntregaRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFotoEntrega} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PANEL ADMIN ────────────────────────────────────────────────────
function PanelAdmin({ user, role }) {
  const [pedidos, setPedidos] = useState([]);
  const [filtroVendedor, setFiltroVendedor] = useState("Todos");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroEntregado, setFiltroEntregado] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState(null); // pedido seleccionado
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const update = async (id, data) => {
    await updateDoc(doc(db, "pedidos", id), { ...data, updatedAt: serverTimestamp() });
  };

  const filtrados = pedidos.filter(p => {
    const matchV = filtroVendedor === "Todos" || p.vendedorNombre === filtroVendedor;
    const matchE = filtroEstado === "Todos" || p.estadoCobro === filtroEstado;
    const matchEnt = filtroEntregado === "Todos" || (filtroEntregado === "Entregado" ? p.entregado : !p.entregado);
    const matchB = !busqueda || p.nombreCliente?.toLowerCase().includes(busqueda.toLowerCase()) || p.nroFactura?.toLowerCase().includes(busqueda.toLowerCase());
    return matchV && matchE && matchEnt && matchB;
  });

  const totalFiltrado = filtrados.reduce((s, p) => s + (p.total || 0), 0);

  const exportar = () => {
    const rows = filtrados.map(p => ({
      "Fecha": p.createdAt?.toDate?.()?.toLocaleDateString?.("es-BO") || "-",
      "Vendedor": p.vendedorNombre,
      "Cliente": p.nombreCliente,
      "Teléfono": p.telefono || "",
      "NIT": p.nit || "",
      "Razón Social": p.razonSocial || "",
      "Canal": p.canal || "",
      "Tipo de Baja": p.tipoBaja || "",
      "Autorizar Baja": p.autorizarBaja || "",
      "Autorizar Crédito": p.autorizarCredito || "",
      "Días Crédito Admin": p.diasCreditoAdmin || "",
      "Productos": (p.lineas || []).map(l => `${l.codigo} x${l.cantidad} ($${l.precio})`).join(" | "),
      "Subtotal Prod.": p.subtotalProductos || 0,
      "Costo Envío": p.costoEnvio || 0,
      "Total": p.total || 0,
      "Forma de Pago": p.formaPago || "",
      "Estado Cobro": p.estadoCobro || "",
      "Días Crédito": p.diasCredito || "",
      "Dirección": p.direccion || "",
      "Día Entrega": p.diaEntrega || "",
      "Horario Entrega": p.horarioEntrega || "",
      "Entregar Hoy": p.entregarHoy ? "Sí" : "No",
      "Entregado": p.entregado ? "Sí" : "No",
      "Nro. Factura": p.nroFactura || "",
      "Estado Admin": p.estadoAdmin || "",
      "Notas": p.notas || "",
      "Imágenes": (p.imagenes || []).join(", "),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos CDZ");
    XLSX.writeFile(wb, `CDZ_Pedidos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const vendedoresUnicos = [...new Set(pedidos.map(p => p.vendedorNombre))].filter(Boolean);

  const estadoBadge = (e) => {
    const map = {
      "Pago Realizado": { bg: "rgba(40,167,69,0.15)", color: "#28a745", border: "#28a745" },
      "Por Cobrar":     { bg: "rgba(255,193,7,0.15)",  color: "#ffc107", border: "#ffc107" },
      "Al Crédito":     { bg: "rgba(58,143,212,0.15)", color: "#3a8fd4", border: "#3a8fd4" },
    };
    const s = map[e] || { bg: "#222", color: C.textMuted, border: "#444" };
    return { padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` };
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a0800, #2a1200)", borderBottom: `1px solid #3a2010`, padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo-cdz.png" alt="CDZ" style={{ width: 32, height: 32, filter: "invert(1)", mixBlendMode: "screen" }} />
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", color: C.gold, fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>CDZ — Panel Admin</div>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 3 }}>GESTIÓN DE PEDIDOS</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button style={{ ...btn("success"), padding: "9px 20px", fontSize: 13 }} onClick={exportar}>📥 Exportar Excel</button>
          <button style={{ ...btn("ghost"), padding: "9px 16px", fontSize: 13 }} onClick={() => signOut(auth)}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Pedidos", val: pedidos.length, icon: "📋" },
            { label: "Filtrados", val: filtrados.length, icon: "🔍" },
            { label: "Total Filtrado", val: `$${totalFiltrado.toLocaleString()}`, icon: "💰" },
            { label: "Entregados", val: pedidos.filter(p => p.entregado).length, icon: "✅" },
            { label: "Pendientes entrega", val: pedidos.filter(p => !p.entregado).length, icon: "⏳" },
          ].map(s => (
            <div key={s.label} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.gold, fontFamily: "'Playfair Display', serif" }}>{s.val}</div>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ ...card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 180px" }}>
            <label style={lbl}>Buscar</label>
            <input style={inp} placeholder="Cliente o N° factura..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={lbl}>Vendedor</label>
            <select style={sel} value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}>
              <option value="Todos">Todos</option>
              {vendedoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={lbl}>Estado Cobro</label>
            <select style={sel} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="Todos">Todos</option>
              {ESTADOS_COBRO.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={lbl}>Entrega</label>
            <select style={sel} value={filtroEntregado} onChange={e => setFiltroEntregado(e.target.value)}>
              <option value="Todos">Todos</option>
              <option value="Entregado">Entregado</option>
              <option value="Pendiente">Pendiente entrega</option>
            </select>
          </div>
        </div>

        {/* Modal detalle/edición */}
        {(detalle || editando) && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
            onClick={e => e.target === e.currentTarget && (setDetalle(null), setEditando(null))}>
            <div style={{ background: "#161616", border: `1px solid #333`, borderRadius: 16, padding: 28, width: "min(95vw,680px)", maxHeight: "90vh", overflowY: "auto" }}>
              {(() => {
                const p = detalle || editando;
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", color: C.gold, fontSize: 20, fontWeight: 700 }}>
                        {editando ? "✏️ Gestionar Pedido" : "📋 Detalle del Pedido"}
                      </div>
                      <button style={{ ...btn("ghost"), padding: "5px 12px" }} onClick={() => { setDetalle(null); setEditando(null); }}>✕</button>
                    </div>

                    {/* Info cliente */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      {[
                        ["Cliente", p.nombreCliente],
                        ["Vendedor", p.vendedorNombre],
                        ["Teléfono", p.telefono || "—"],
                        ["Canal", p.canal || "—"],
                        ...(p.canal === "BAJAS" ? [["Tipo de Baja", p.tipoBaja || "—"], ["Autorizar Baja", p.autorizarBaja || "Pendiente"]] : []),
                        ["NIT", p.nit || "—"],
                        ["Razón Social", p.razonSocial || "—"],
                        ...(p.canal !== "BAJAS" ? [["Forma de Pago", p.formaPago || "—"],
                        ["Estado Cobro", p.estadoCobro + (p.diasCredito ? ` (${p.diasCredito})` : "")],
                        ...(p.estadoCobro === "Al Crédito" ? [["Aut. Crédito", (p.autorizarCredito || "Pendiente") + (p.diasCreditoAdmin ? ` (${p.diasCreditoAdmin})` : "")]] : [])] : []),
                        ["Dirección", p.direccion || "—"],
                        ["Día Entrega", p.diaEntrega || "—"],
                        ["Horario Entrega", p.horarioEntrega || "—"],
                        ["Fecha", p.createdAt?.toDate?.()?.toLocaleString?.("es-BO") || "—"],
                      ].map(([k, v]) => (
                        <div key={k} style={{ background: "#1a1a1a", borderRadius: 8, padding: 10 }}>
                          <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{k}</div>
                          <div style={{ fontSize: 13, color: C.text }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Productos */}
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
                      <thead>
                        <tr>
                          {["Código", "Producto", "Cant.", "Precio", "Subtotal"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid #2a2a2a`, color: C.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(p.lineas || []).map((l, i) => {
                          const prod = PRODUCTOS.find(x => x.codigo === l.codigo);
                          return (
                            <tr key={i}>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid #1a1a1a`, color: C.gold, fontWeight: 600 }}>{l.codigo}</td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid #1a1a1a`, color: C.text }}>{prod?.nombre || l.codigo}</td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid #1a1a1a`, color: C.textSub }}>{l.cantidad}</td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid #1a1a1a`, color: C.textSub }}>${parseFloat(l.precio).toLocaleString()}</td>
                              <td style={{ padding: "9px 10px", borderBottom: `1px solid #1a1a1a`, color: C.gold, fontWeight: 700 }}>${(parseFloat(l.precio) * parseInt(l.cantidad)).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                        {p.costoEnvio > 0 && (
                          <tr>
                            <td colSpan={4} style={{ padding: "9px 10px", color: C.textMuted, textAlign: "right", fontSize: 12 }}>Costo de envío</td>
                            <td style={{ padding: "9px 10px", color: C.textSub, fontWeight: 600 }}>${p.costoEnvio.toLocaleString()}</td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={4} style={{ padding: "10px 10px", fontWeight: 700, color: C.textMuted, textAlign: "right", fontSize: 13 }}>TOTAL</td>
                          <td style={{ padding: "10px 10px", color: C.gold, fontWeight: 800, fontSize: 18 }}>${(p.total || 0).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>

                    {p.notas && <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 12, fontSize: 13, color: C.textSub, marginBottom: 16 }}><b style={{ color: C.gold }}>Notas:</b> {p.notas}</div>}

                    {(p.imagenes || []).length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Imágenes / Comprobante</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {p.imagenes.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid #333` }} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {(p.fotosEntrega || []).length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: C.success, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>📷 Fotos de Entrega</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {p.fotosEntrega.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.success}` }} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Campos de gestión admin */}
                    {editando && (
                      <div style={{ borderTop: `1px solid #2a2a2a`, paddingTop: 20, marginTop: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>⚙️ Gestión Admin</div>

                        {editando.canal === "BAJAS" && (() => {
                          const original = pedidos.find(x => x.id === editando.id);
                          const yaGestionada = !!(original && original.autorizarBaja);
                          return (
                            <div style={{ marginBottom: 14, background: "#1a1a1a", borderRadius: 10, padding: 14, border: `1px solid ${yaGestionada ? (original.autorizarBaja === "Autorizada" ? C.success : C.danger) : C.gold}` }}>
                              <label style={{ ...lbl, fontSize: 12, color: C.gold }}>Autorizar Baja *</label>
                              {yaGestionada ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                                  <span style={{ fontSize: 18 }}>{original.autorizarBaja === "Autorizada" ? "✅" : "❌"}</span>
                                  <span style={{ fontSize: 15, fontWeight: 700, color: original.autorizarBaja === "Autorizada" ? C.success : C.danger }}>
                                    {original.autorizarBaja}
                                  </span>
                                  <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>(ya gestionada, no se puede modificar)</span>
                                </div>
                              ) : role === "finan" ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                                  <span style={{ fontSize: 11, color: C.textMuted }}>(sin acceso para autorizar baja)</span>
                                </div>
                              ) : (
                                <select style={sel} value={editando.autorizarBaja || ""} onChange={e => setEditando(x => ({ ...x, autorizarBaja: e.target.value }))}>
                                  <option value="">— Seleccionar —</option>
                                  <option value="Autorizada">Autorizada</option>
                                  <option value="Rechazada">Rechazada</option>
                                </select>
                              )}
                            </div>
                          );
                        })()}

                        {editando.estadoCobro === "Al Crédito" && (() => {
                          const original = pedidos.find(x => x.id === editando.id);
                          const yaGestionada = !!(original && original.autorizarCredito);
                          return (
                            <div style={{ marginBottom: 14, background: "#1a1a1a", borderRadius: 10, padding: 14, border: `1px solid ${yaGestionada ? (original.autorizarCredito === "Autorizado" ? C.success : C.danger) : C.gold}` }}>
                              <label style={{ ...lbl, fontSize: 12, color: C.gold }}>Autorizar Crédito *</label>
                              {yaGestionada ? (
                                <div style={{ marginTop: 6 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontSize: 18 }}>{original.autorizarCredito === "Autorizado" ? "✅" : "❌"}</span>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: original.autorizarCredito === "Autorizado" ? C.success : C.danger }}>
                                      {original.autorizarCredito}
                                    </span>
                                    <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>(ya gestionado, no se puede modificar)</span>
                                  </div>
                                  <div style={{ fontSize: 12, color: C.textSub }}>Días de crédito: <b style={{ color: C.gold }}>{original.diasCreditoAdmin || original.diasCredito || "—"}</b></div>
                                </div>
                              ) : role === "finan" ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                                  <span style={{ fontSize: 11, color: C.textMuted }}>(sin acceso para autorizar crédito)</span>
                                </div>
                              ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                                  <div>
                                    <label style={{ ...lbl, fontSize: 11 }}>Decisión</label>
                                    <select style={sel} value={editando.autorizarCredito || ""} onChange={e => setEditando(x => ({ ...x, autorizarCredito: e.target.value }))}>
                                      <option value="">— Seleccionar —</option>
                                      <option value="Autorizado">Autorizado</option>
                                      <option value="Rechazado">Rechazado</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ ...lbl, fontSize: 11 }}>Días de Crédito</label>
                                    <select style={sel} value={editando.diasCreditoAdmin || editando.diasCredito || ""} onChange={e => setEditando(x => ({ ...x, diasCreditoAdmin: e.target.value }))}>
                                      <option value="">— Seleccionar —</option>
                                      {DIAS_CREDITO.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                          <div>
                            <label style={lbl}>N° de Factura</label>
                            <input style={{ ...inp, opacity: role === "comm" ? 0.4 : 1 }} value={editando.nroFactura || ""} onChange={e => { if (role !== "comm") setEditando(x => ({ ...x, nroFactura: e.target.value })); }} placeholder={role === "comm" ? "Sin acceso" : "Ej: FAC-001234"} disabled={role === "comm"} />
                          </div>
                          <div>
                            <label style={lbl}>Estado Admin</label>
                            <select style={sel} value={editando.estadoAdmin || "Pendiente"} onChange={e => setEditando(x => ({ ...x, estadoAdmin: e.target.value }))}>
                              {["Pendiente", "En preparación", "Despachado", "Completado", "Cancelado"].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                        <div style={{ marginBottom: 20 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                            <div
                              onClick={() => { if (role !== "finan") setEditando(x => ({ ...x, entregado: !x.entregado })); }}
                              style={{ width: 50, height: 28, borderRadius: 14, background: editando.entregado ? C.success : "#333", transition: "all 0.2s", position: "relative", cursor: role === "finan" ? "not-allowed" : "pointer", flexShrink: 0, opacity: role === "finan" ? 0.4 : 1 }}
                            >
                              <div style={{ position: "absolute", top: 4, left: editando.entregado ? 25 : 4, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "all 0.2s" }} />
                            </div>
                            <span style={{ fontSize: 15, color: editando.entregado ? C.success : C.textMuted, fontWeight: editando.entregado ? 600 : 400 }}>
                              {editando.entregado ? "✅ Pedido Entregado" : "⏳ Pendiente de Entrega"}
                              {role === "finan" && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>(sin acceso)</span>}
                            </span>
                          </label>
                        </div>
                        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                          <button style={{ ...btn("ghost"), padding: "10px 20px" }} onClick={() => setEditando(null)}>Cancelar</button>
                          <button style={{ ...btn("primary"), padding: "10px 24px" }} onClick={async () => {
                            const updateData = {
                              nroFactura: editando.nroFactura,
                              estadoAdmin: editando.estadoAdmin,
                              entregado: editando.entregado,
                            };
                            if (editando.canal === "BAJAS" && editando.autorizarBaja) {
                              const orig = pedidos.find(x => x.id === editando.id);
                              if (!orig?.autorizarBaja) {
                                updateData.autorizarBaja = editando.autorizarBaja;
                              }
                            }
                            if (editando.estadoCobro === "Al Crédito" && editando.autorizarCredito) {
                              const orig = pedidos.find(x => x.id === editando.id);
                              if (!orig?.autorizarCredito) {
                                updateData.autorizarCredito = editando.autorizarCredito;
                                updateData.diasCreditoAdmin = editando.diasCreditoAdmin || editando.diasCredito || "";
                              }
                            }
                            await update(editando.id, updateData);
                            setEditando(null);
                          }}>Guardar cambios</button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tabla de pedidos */}
        <div style={card}>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 14 }}>
            Mostrando <b style={{ color: C.gold }}>{filtrados.length}</b> de {pedidos.length} pedidos
          </div>
          {filtrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
              <img src="/logo-cdz.png" alt="CDZ" style={{ width: 52, height: 52, marginBottom: 12, filter: "invert(1)", mixBlendMode: "screen" }} />
              <div>No hay pedidos que coincidan</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Fecha", "Vendedor", "Cliente", "Canal", "Productos", "Total", "Pago", "Estado", "Aut. Baja", "Aut. Crédito", "Factura", "Entregado", "Fotos", "Acciones"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", borderBottom: `1px solid #2a2a2a`, color: C.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(p => (
                    <tr key={p.id} style={{ cursor: "pointer", borderBottom: `1px solid #1a1a1a` }}
                      onClick={() => setDetalle(p)}
                      onMouseEnter={e => e.currentTarget.style.background = "#1a1a1a"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "11px 12px", color: C.textMuted, whiteSpace: "nowrap", fontSize: 12 }}>{p.createdAt?.toDate?.()?.toLocaleDateString?.("es-BO") || "—"}</td>
                      <td style={{ padding: "11px 12px", color: C.textSub, fontSize: 12, whiteSpace: "nowrap" }}>{p.vendedorNombre}</td>
                      <td style={{ padding: "11px 12px", color: C.text, fontWeight: 600 }}>{p.nombreCliente}</td>
                      <td style={{ padding: "11px 12px", color: C.textMuted, fontSize: 12 }}>{p.canal || "—"}</td>
                      <td style={{ padding: "11px 12px", color: C.textMuted, fontSize: 12 }}>{(p.lineas || []).length} línea(s)</td>
                      <td style={{ padding: "11px 12px", color: C.gold, fontWeight: 700, whiteSpace: "nowrap" }}>${(p.total || 0).toLocaleString()}</td>
                      <td style={{ padding: "11px 12px" }}><span style={estadoBadge(p.estadoCobro)}>{p.estadoCobro}</span></td>
                      <td style={{ padding: "11px 12px" }}>
                        <span style={{ fontSize: 11, color: p.estadoAdmin === "Completado" ? C.success : p.estadoAdmin === "Cancelado" ? C.danger : C.textMuted }}>
                          {p.estadoAdmin || "Pendiente"}
                        </span>
                      </td>
                      <td style={{ padding: "11px 12px" }}>
                        {p.canal === "BAJAS" ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: p.autorizarBaja === "Autorizada" ? C.success : p.autorizarBaja === "Rechazada" ? C.danger : C.textMuted }}>
                            {p.autorizarBaja || "Pendiente"}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: C.textMuted }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "11px 12px" }}>
                        {p.estadoCobro === "Al Crédito" ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: p.autorizarCredito === "Autorizado" ? C.success : p.autorizarCredito === "Rechazado" ? C.danger : C.textMuted }}>
                            {p.autorizarCredito || "Pendiente"}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: C.textMuted }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "11px 12px", color: p.nroFactura ? C.gold : C.textMuted, fontSize: 12, fontWeight: p.nroFactura ? 600 : 400 }}>
                        {p.nroFactura || "—"}
                      </td>
                      <td style={{ padding: "11px 12px", textAlign: "center" }}>
                        <span style={{ fontSize: 16 }}>{p.entregado ? "✅" : "⏳"}</span>
                      </td>
                      <td style={{ padding: "11px 12px", textAlign: "center" }}>
                        {(p.fotosEntrega || []).length > 0 ? (
                          <span style={{ fontSize: 11, color: C.success, fontWeight: 700, cursor: "pointer" }} onClick={e => { e.stopPropagation(); setDetalle(p); }}>
                            📷 {(p.fotosEntrega || []).length}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: C.textMuted }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "11px 12px" }} onClick={e => e.stopPropagation()}>
                        <button
                          style={{ ...btn("gold"), padding: "5px 12px", fontSize: 12 }}
                          onClick={() => setEditando({ ...p })}
                        >
                          ✏️ Gestionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ───────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [vendedorNombre, setVendedorNombre] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            setUserRole(snap.data().role || "vendedor");
          } else {
            await setDoc(doc(db, "users", u.uid), { email: u.email, role: "vendedor", createdAt: serverTimestamp() });
            setUserRole("vendedor");
          }
        } catch { setUserRole("vendedor"); }
        setVendedorNombre(VENDEDORES[u.email] || u.email);
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
      <div style={{ color: "#C8962E", fontSize: 18, fontFamily: "Georgia, serif", display: "flex", alignItems: "center", gap: 8 }}><img src="/logo-cdz.png" alt="CDZ" style={{ width: 28, height: 28, filter: "invert(1)", mixBlendMode: "screen" }} /> Cargando...</div>
    </div>
  );

  if (!user) return <Login />;
  if (userRole === "admin") return <PanelAdmin user={user} role="admin" />;
  if (userRole === "comm") return <PanelAdmin user={user} role="comm" />;
  if (userRole === "finan") return <PanelAdmin user={user} role="finan" />;
  return <FormVendedor user={user} vendedorNombre={vendedorNombre} />;
}
