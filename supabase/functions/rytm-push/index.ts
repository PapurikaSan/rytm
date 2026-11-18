// Rytm: wysyłanie przypomnień (Supabase Edge Function)
// Akcje: "public-key" (klucz publiczny dla telefonu), "run" (co 5 minut z harmonogramu; rodzaje przypomnień: missing, review, weekly, monthly, custom),
// "test" (próbne powiadomienie dla zalogowanego użytkownika), "kudos" (piątka dla znajomego z tej samej grupy).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP_URL = "https://papurikasan.github.io/rytm/";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Klucze VAPID: tworzone przy pierwszym użyciu i trzymane w bazie, nigdy w kodzie.
async function keys() {
  const { data } = await sb.from("rytm_config").select("value").eq("key", "vapid").maybeSingle();
  if (data) return data.value;
  const k = webpush.generateVAPIDKeys();
  const { error } = await sb.from("rytm_config").insert({ key: "vapid", value: k });
  if (error) {
    const again = await sb.from("rytm_config").select("value").eq("key", "vapid").single();
    return again.data!.value;
  }
  return k;
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function local(tz: string, now = new Date()) {
  let f;
  try {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
  } catch {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
  }
  const p: Record<string, string> = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute, dow: DOW.indexOf(p.weekday) };
}
const addDay = (s: string, n: number) => {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekStart = (s: string) => addDay(s, -((new Date(s + "T12:00:00Z").getUTCDay() + 6) % 7));

// Czego brakuje dziś (te same zasady co lista „Uzupełnione” w aplikacji).
// deno-lint-ignore no-explicit-any
export function missing(d: any, day: string): string[] {
  if (d.off && d.off[day]) return [];
  const log = (d.log && d.log[day]) || {};
  const out: string[] = [];
  if (!d.mood || d.mood[day] == null) out.push("nastrój");
  // deno-lint-ignore no-explicit-any
  const paused = (g: any) => (g.pauses || []).some((p: any) => day >= p.from && (!p.to || day < p.to));
  // cele, przy których użytkownik już odpowiedział (np. „Nie” w „Domknij dzień”), nie są brakami
  const ans: string[] = (d.asst && d.asst.ck && d.asst.ck[day]) || [];
  for (const g of d.goals || []) {
    if (paused(g) || ans.includes(g.id)) continue;
    const v = log[g.id];
    if (g.type === "qty" || g.type === "range" || (g.type === "measure" && g.period === "day")) {
      if (v == null) out.push(g.name);
    } else if (g.type === "do" && g.period === "day") {
      if (!v) out.push(g.name);
    } else if (g.type === "measure" && g.period === "week") {
      let has = false;
      for (let x = weekStart(day); x <= day; x = addDay(x, 1)) if (d.log && d.log[x] && d.log[x][g.id] != null) has = true;
      if (!has) out.push(g.name + " (pomiar w tym tygodniu)");
    }
  }
  return out;
}
const list = (a: string[]) => {
  const x = a.slice(0, 5);
  const rest = a.length - x.length;
  if (rest > 0) return x.join(", ") + " i " + rest + " więcej";
  return x.length > 1 ? x.slice(0, -1).join(", ") + " i " + x[x.length - 1] : x[0];
};
// deno-lint-ignore no-explicit-any
export function message(r: any, d: any, day: string) {
  if (r.kind === "missing") {
    const m = missing(d, day);
    if (!m.length) return null;
    return { title: "Uzupełnij dzień", body: "Brakuje: " + list(m) + ". Dotknij i domknij dzień na jednym ekranie.", url: APP_URL + "#pixa-fill" };
  }
  if (r.kind === "review") {
    if (d.reviews && d.reviews[weekStart(day)]) return null;
    return { title: "Podsumuj tydzień", body: "Co poszło dobrze, co poprawić? Zajmie minutę.", url: APP_URL + "#week" };
  }
  if (r.kind === "weekly") {
    // Podsumowanie zeszłego tygodnia liczy aplikacja przy każdym zapisie (data.wsum), serwer tylko je wysyła.
    if (new Date(day + "T12:00:00Z").getUTCDay() !== 1) return null;
    const prev = addDay(weekStart(day), -7);
    const w = d.wsum && d.wsum[prev];
    if (w && w.t) return { title: w.t, body: w.b || "Zobacz, jak poszło.", url: APP_URL + "#pixa-week" };
    return { title: "Nowy tydzień", body: "Zeszły tydzień był bez wpisów. Zacznijmy nowy: zaznacz dziś pierwszy cel.", url: APP_URL };
  }
  if (r.kind === "monthly") {
    // Pierwszego dnia miesiąca: podsumowanie poprzedniego (data.msum liczy aplikacja).
    if (day.slice(8) !== "01") return null;
    const d0 = new Date(day + "T12:00:00Z");
    d0.setUTCMonth(d0.getUTCMonth() - 1);
    const prev = d0.toISOString().slice(0, 7) + "-01";
    const w = d.msum && d.msum[prev];
    if (w && w.t) return { title: w.t, body: w.b || "Zobacz, jak poszło.", url: APP_URL + "#pixa-month" };
    return null;
  }
  return { title: "Rytm", body: r.text || "Przypomnienie", url: APP_URL };
}

// deno-lint-ignore no-explicit-any
async function send(sub: any, msg: unknown) {
  try {
    await webpush.sendNotification(sub.sub, JSON.stringify(msg));
    return true;
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const code = (e as any).statusCode;
    if (code === 404 || code === 410) await sb.from("rytm_push").delete().eq("id", sub.id);
    console.error("push error", code, String(e));
    return false;
  }
}

async function run() {
  const k = await keys();
  webpush.setVapidDetails(APP_URL, k.publicKey, k.privateKey);
  const { data: subs } = await sb.from("rytm_push").select("id,user_id,sub");
  if (!subs || !subs.length) return { sent: 0 };
  const users = [...new Set(subs.map((s) => s.user_id))];
  const { data: states } = await sb.from("rytm_state").select("user_id,data").in("user_id", users);
  let sent = 0;
  for (const st of states || []) {
    const set = (st.data && st.data.settings) || {};
    const L = local(set.tz || "Europe/Warsaw");
    for (const r of set.reminders || []) {
      if (!r.on || !r.time) continue;
      if (Array.isArray(r.days) && !r.days.includes(L.dow)) continue;
      const [h, m] = String(r.time).split(":").map(Number);
      const t = h * 60 + m;
      if (L.min < t || L.min >= t + 30) continue;
      const { error } = await sb.from("rytm_push_log").insert({ user_id: st.user_id, rid: r.id, day: L.day });
      if (error) continue; // już wysłane dzisiaj
      const msg = message(r, st.data, L.day);
      if (!msg) continue;
      for (const s of subs.filter((x) => x.user_id === st.user_id)) if (await send(s, msg)) sent++;
    }
  }
  return { sent };
}

async function authUser(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return null;
  const { data: { user } } = await sb.auth.getUser(jwt);
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: { action?: string; to?: string; act?: string; label?: string } = {};
  try { body = await req.json(); } catch { /* pusty */ }
  try {
    if (body.action === "public-key") return json({ publicKey: (await keys()).publicKey });
    if (body.action === "run") return json(await run());
    if (body.action === "kudos") {
      const user = await authUser(req);
      if (!user) return json({ error: "Nie zalogowano" }, 401);
      const to = String(body.to || ""), act = String(body.act || "").slice(0, 30), label = String(body.label || act).slice(0, 40);
      if (!to || !act || to === user.id) return json({ error: "Złe dane" }, 400);
      const { data: mine } = await sb.from("rytm_member").select("group_id").eq("user_id", user.id);
      const { data: theirs } = await sb.from("rytm_member").select("group_id").eq("user_id", to);
      const shared = (mine || []).some((m) => (theirs || []).some((t) => t.group_id === m.group_id));
      if (!shared) return json({ error: "Nie jesteście w tej samej grupie" }, 403);
      const day = local("Europe/Warsaw").day;
      const { error } = await sb.from("rytm_kudos").insert({ from_user: user.id, to_user: to, act, day });
      if (error) return json({ already: true });
      const { data: prof } = await sb.from("rytm_profile").select("name").eq("user_id", user.id).maybeSingle();
      const k = await keys();
      webpush.setVapidDetails(APP_URL, k.publicKey, k.privateKey);
      const { data: subs } = await sb.from("rytm_push").select("id,user_id,sub").eq("user_id", to);
      let sent = 0;
      for (const s of subs || []) if (await send(s, { title: "Piątka!", body: (prof?.name || "Znajomy") + " przybija Ci piątkę: " + label, url: APP_URL + "#friends" })) sent++;
      return json({ ok: true, sent });
    }
    if (body.action === "test") {
      const user = await authUser(req);
      if (!user) return json({ error: "Nie zalogowano" }, 401);
      const k = await keys();
      webpush.setVapidDetails(APP_URL, k.publicKey, k.privateKey);
      const { data: subs } = await sb.from("rytm_push").select("id,user_id,sub").eq("user_id", user.id);
      let sent = 0;
      for (const s of subs || []) if (await send(s, { title: "Rytm", body: "Przypomnienia działają. Tak będą wyglądać.", url: APP_URL })) sent++;
      return json({ sent, devices: (subs || []).length });
    }
    return json({ error: "Nieznana akcja" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
