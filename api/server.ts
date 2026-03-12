import express from "express";
import admin from "firebase-admin";

// 1. Khởi tạo Firebase Admin (Tối ưu cho Serverless)
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (projectId && clientEmail && privateKey) {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
      console.log("Firebase Admin initialized successfully");
    } catch (error) {
      console.error("Firebase initialization error:", error);
    }
  }
}

const db = admin.firestore();

// Helper lấy dữ liệu
const getDocs = async (collection: string, queryFn?: (ref: admin.firestore.CollectionReference) => admin.firestore.Query) => {
  let ref: admin.firestore.Query = db.collection(collection);
  if (queryFn) ref = queryFn(db.collection(collection));
  const snapshot = await ref.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const app = express();
app.use(express.json());

// --- API ROUTES ---

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.ADMIN_PASSWORD || 'admin123';
  res.json({ success: password === correctPassword });
});

// Competitions
app.get("/api/competitions", async (req, res) => {
  try { res.json(await getDocs("competitions")); } catch (e) { res.status(500).send(e); }
});

app.post("/api/competitions", async (req, res) => {
  try {
    const { name, date } = req.body;
    const docRef = await db.collection("competitions").add({ name, date, is_locked: false });
    res.json({ id: docRef.id });
  } catch (e) { res.status(500).send(e); }
});

app.put("/api/competitions/:id", async (req, res) => {
  try {
    await db.collection("competitions").doc(req.params.id).update(req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).send(e); }
});

app.delete("/api/competitions/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await db.collection("competitions").doc(id).delete();
    const collections = ["classes", "events", "judges"];
    for (const coll of collections) {
      const snap = await db.collection(coll).where("competition_id", "==", id).get();
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).send(e); }
});

app.get("/api/competitions/:id/full", async (req, res) => {
  try {
    const id = req.params.id;
    const compDoc = await db.collection("competitions").doc(id).get();
    if (!compDoc.exists) return res.status(404).json({ error: "Competition not found" });

    const [classes, events, judges, conversions] = await Promise.all([
      getDocs("classes", ref => ref.where("competition_id", "==", id)),
      getDocs("events", ref => ref.where("competition_id", "==", id)),
      getDocs("judges", ref => ref.where("competition_id", "==", id)),
      getDocs("conversions", ref => ref.orderBy("rank"))
    ]);

    const sortItems = (items: any[]) => items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const eventIds = events.map(e => e.id);
    let scores: any[] = [];
    if (eventIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < eventIds.length; i += 10) chunks.push(eventIds.slice(i, i + 10));
      const snaps = await Promise.all(chunks.map(c => db.collection("scores").where("event_id", "in", c).get()));
      scores = snaps.flatMap(s => s.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    res.json({ competition: { id: compDoc.id, ...compDoc.data() }, classes: sortItems(classes), events: sortItems(events), judges: sortItems(judges), scores, conversions });
  } catch (e) { res.status(500).send(e); }
});

// Reorder
app.post("/api/reorder", async (req, res) => {
  try {
    const { collection, items } = req.body;
    const batch = db.batch();
    items.forEach((item: any) => batch.update(db.collection(collection).doc(item.id), { order: item.order }));
    await batch.commit();
    res.json({ success: true });
  } catch (e) { res.status(500).send(e); }
});

// Classes
app.post("/api/classes", async (req, res) => {
  try {
    const { name, grade, competition_id, order } = req.body;
    const docRef = await db.collection("classes").add({ 
      name, grade, competition_id, order: order || 0, bonus_points: 0, penalty_points: 0 
    });
    res.json({ id: docRef.id });
  } catch (e) { res.status(500).send(e); }
});

app.put("/api/classes/:id", async (req, res) => {
  try {
    await db.collection("classes").doc(req.params.id).update(req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).send(e); }
});

app.delete("/api/classes/:id", async (req, res) => {
  try {
    await db.collection("classes").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).send(e); }
});

// --- EVENTS (ĐÃ THÊM judge_count) ---
app.post("/api/events", async (req, res) => {
  try {
    const { name, competition_id, type, round_count, weight, order, round_names, ranking_scope, judge_count } = req.body;
    const docRef = await db.collection("events").add({ 
      name, competition_id, type, round_count, weight, is_locked: false, 
      order: order || 0, round_names: round_names || [], 
      ranking_scope: ranking_scope || 'grade',
      judge_count: judge_count || 1 // LƯU SỐ GIÁM KHẢO
    });
    res.json({ id: docRef.id });
  } catch (e) { res.status(500).send(e); }
});

app.put("/api/events/:id", async (req, res) => {
  try {
    // Cập nhật toàn bộ body (bao gồm cả judge_count nếu có)
    await db.collection("events").doc(req.params.id).update(req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).send(e); }
});

app.delete("/api/events/:id", async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).send(e); }
});

// Judges
app.post("/api/judges", async (req, res) => {
  try {
    const docRef = await db.collection("judges").add({ ...req.body, order: req.body.order || 0 });
    res.json({ id: docRef.id });
  } catch (e) { res.status(500).send(e); }
});

app.put("/api/judges/:id", async (req, res) => {
  try {
    await db.collection("judges").doc(req.params.id).update(req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).send(e); }
});

app.delete("/api/judges/:id", async (req, res) => {
  try {
    await db.collection("judges").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).send(e); }
});

app.post("/api/judges/login", async (req, res) => {
  try {
    const { code, competition_id } = req.body;
    const snap = await db.collection("judges").where("code", "==", code.trim()).where("competition_id", "==", competition_id).limit(1).get();
    if (!snap.empty) res.json({ id: snap.docs[0].id, ...snap.docs[0].data() });
    else res.status(401).json({ error: "Mã sai" });
  } catch (e) { res.status(500).send(e); }
});

// Scores
app.post("/api/scores/bulk", async (req, res) => {
  try {
    const { scores } = req.body;
    for (let i = 0; i < scores.length; i += 500) {
      const chunk = scores.slice(i, i + 500);
      const batch = db.batch();
      for (const s of chunk) {
        const eventDoc = await db.collection("events").doc(s.event_id).get();
        if (!eventDoc.exists || eventDoc.data()?.is_locked) continue;
        const compDoc = await db.collection("competitions").doc(eventDoc.data()?.competition_id).get();
        if (compDoc.exists && compDoc.data()?.is_locked) continue;

        const query = db.collection("scores").where("class_id", "==", s.class_id).where("event_id", "==", s.event_id).where("judge_id", "==", s.judge_id).where("round", "==", s.round);
        const existing = await query.get();
        const targetDoc = existing.docs.find(d => d.data().category === s.category || (!d.data().category && !s.category));
        if (targetDoc) batch.update(targetDoc.ref, { score: s.score });
        else batch.set(db.collection("scores").doc(), { ...s, category: s.category || null });
      }
      await batch.commit();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).send(e); }
});

// Conversions
app.get("/api/conversions", async (req, res) => {
  try { res.json(await getDocs("conversions", ref => ref.orderBy("rank"))); } catch (e) { res.status(500).send(e); }
});

app.post("/api/conversions", async (req, res) => {
  try {
    const snap = await db.collection("conversions").get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    req.body.conversions.forEach((c: any) => batch.set(db.collection("conversions").doc(), { rank: c.rank, points: c.points }));
    await batch.commit();
    res.json({ success: true });
  } catch (e) { res.status(500).send(e); }
});

export default app;
