/* Google Drive read access for the IMC app without an API key: a Google "service account" (a robot Google account).
   The manager shares the trailers folder with the robot's email. Its key file (JSON) is added ONCE on each PC that needs
   it (the manager's PC in the hub, each foyer PC on the TV app's set-up screen) and kept only in that PC's browser
   storage ("imc-gsa"): it is never published or sent anywhere except to Google to sign in.
   IMCDrive.saved() → the key on this PC, or null   IMCDrive.save(json) / IMCDrive.forget()
   IMCDrive.list(sa, folderId) → files   IMCDrive.download(sa, id) → Blob   (read-only: drive.readonly) */
(function () {
  const LS = "imc-gsa";
  let tok = null, tokFor = "", tokUntil = 0;
  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64uStr = (s) => b64u(new TextEncoder().encode(s));
  function saved() { try { const j = JSON.parse(localStorage.getItem(LS) || "null"); return j && j.client_email && j.private_key ? j : null } catch (e) { return null } }
  function save(json) { const j = typeof json === "string" ? JSON.parse(json) : json; if (!j || !j.client_email || !j.private_key) throw new Error("not a key file");
    localStorage.setItem(LS, JSON.stringify({ client_email: j.client_email, private_key: j.private_key })); tok = null; return j.client_email }
  function forget() { try { localStorage.removeItem(LS) } catch (e) {} tok = null }
  async function key(pem) {
    const body = String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  }
  async function token(sa, now) {
    if (tok && tokFor === sa.client_email && Date.now() < tokUntil) return tok;
    const t = Math.floor((now || Date.now()) / 1000),
      head = b64uStr(JSON.stringify({ alg: "RS256", typ: "JWT" })),
      claim = b64uStr(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: t - 30, exp: t + 3000 })),
      sig = b64u(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await key(sa.private_key), new TextEncoder().encode(head + "." + claim)));
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + head + "." + claim + "." + sig });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(String(j.error_description || j.error || "Google sign-in failed"));
    tok = j.access_token; tokFor = sa.client_email; tokUntil = Date.now() + Math.max(60, (j.expires_in || 3600) - 300) * 1000; return tok;
  }
  async function list(sa, folder, now) {
    const q = encodeURIComponent(`'${folder}' in parents and trashed=false`),
      r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,mimeType,videoMediaMetadata(durationMillis))&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        { headers: { Authorization: "Bearer " + (await token(sa, now)) }, cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || "Google Drive said no (" + r.status + ")");
    return j.files || [];
  }
  async function download(sa, id, now) {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: "Bearer " + (await token(sa, now)) } });
    if (!r.ok) throw new Error("download failed (" + r.status + ")");
    return r.blob();
  }
  window.IMCDrive = { saved, save, forget, list, download };
})();
