import express from "express";
import admin from "firebase-admin";

// 1. Khởi tạo Firebase Admin (Tối ưu cho Vercel Serverless)
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (projectId && clientEmail && privateKey) {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log("Firebase Admin initialized successfully");
    } catch (error) {
      console.error("Firebase initialization error:", error);
    }
  }
} else {
  console.warn("Firebase credentials missing in Environment Variables.");
}

const db = admin.firestore();

// Helper lấy dữ liệu với ID
const getDocs = async (collection: string, queryFn?: (ref: admin.firestore.CollectionReference) => admin.firestore.Query) => {
  let ref: admin.firestore.Query = db.collection(collection);
  if (queryFn) ref = queryFn(db.collection(collection));
  const snapshot = await ref.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const app = express();
app.use(express.json());

// --- API ROUTES ---

// Admin Login
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.ADMIN_PASSWORD || 'admin123';
  if (password === correctPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Mật khẩu không chính xác" });
  }
});

// Competitions
app.get("/api/competitions", async (req, res) => {
  try {
    const rows = await getDocs("competitions");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Error fetching competitions" });
  }
});

app.post("/api/competitions", async (req, res) => {
  try {
    const { name, date } = req.body;
    if (!name || !date) return res.status(400).json({ error: "Thiếu tên hoặc ngày tổ chức" });
    const docRef = await db.collection("competitions").add({ name, date, is_locked: false });
    res.json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi tạo hội thi" });
  }
});

app.put("/api/competitions/:id", async (req, res) => {
  try {
    const { name, date, is_locked } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (date !== undefined) updateData.date = date;
    if (is_locked !== undefined) updateData.is_locked = is_locked;
    await db.collection("competitions").doc(req.params.id).update(updateData);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error updating competition" });
  }
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
  } catch (error) {
    res.status(500).json({ error: "Error deleting competition" });
  }
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

    const sortItems = (items: any[]) => items.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.name && b.name) return a.name.localeCompare(b.name, undefined, { numeric: true });
      return 0;
    });

    const eventIds = events.map(e => e.id);
    let scores: any[] = [];
    if (eventIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < eventIds.length; i += 10) {
        chunks.push(eventIds.slice(i, i + 10));
      }
      const scoreSnaps = await Promise.all(chunks.map(chunk => 
        db.collection("scores").where("event_id", "in", chunk).get()
      ));
      scores = scoreSnaps.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }

    res.json({
      competition: { id: compDoc.id, ...compDoc.data() },
      classes: sortItems(classes),
      events: sortItems(events),
      judges: sortItems(judges),
      scores,
      conversions
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching full data" });
  }
});

// Reorder & Classes (Cập nhật Bonus/Penalty)
app.post("/api/reorder", async (req, res) => {
  try {
    const { collection, items } = req.body;
    const batch = db.batch();
    items.forEach((item: any) => batch.update(db.collection(collection).doc(item.id), { order: item.order }));
    await batch.commit();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error reordering" }); }
});

app.post("/api/classes", async (req, res) => {
  try {
    const { name, grade, competition_id, order } = req.body;
    const docRef = await db.collection("classes").add({ 
      name, grade, competition_id, order: order || 0, bonus_points: 0, penalty_points: 0 
    });
    res.json({ id: docRef.id });
  } catch (error) { res.status(500).json({ error: "Error creating class" }); }
});

app.put("/api/classes/:id", async (req, res) => {
  try {
    const { name, grade, bonus_points, penalty_points } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (grade !== undefined) updateData.grade = grade;
    if (bonus_points !== undefined) updateData.bonus_points = bonus_points;
    if (penalty_points !== undefined) updateData.penalty_points = penalty_points;
    await db.collection("classes").doc(req.params.id).update(updateData);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error updating class" }); }
});

app.delete("/api/classes/:id", async (req, res) => {
  try {
    await db.collection("classes").doc(req.params.id).delete();
    const scoresSnap = await db.collection("scores").where("class_id", "==", req.params.id).get();
    const batch = db.batch();
    scoresSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error deleting class" }); }
});

// Events (Cập nhật Ranking Scope)
app.post("/api/events", async (req, res) => {
  try {
    const { name, competition_id, type, round_count, weight, order, round_names, ranking_scope } = req.body;
    const docRef = await db.collection("events").add({ 
      name, competition_id, type, round_count, weight, is_locked: false, 
      order: order || 0, round_names: round_names || [], ranking_scope: ranking_scope || 'grade' 
    });
    res.json({ id: docRef.id });
  } catch (error) { res.status(500).json({ error: "Error creating event" }); }
});

app.put("/api/events/:id", async (req, res) => {
  try {
    const { name, type, round_count, weight, round_names, ranking_scope } = req.body;
    const updateData: any = { name, type, round_count, weight, round_names: round_names || [] };
    if (ranking_scope !== undefined) updateData.ranking_scope = ranking_scope;
    await db.collection("events").doc(req.params.id).update(updateData);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error updating event" }); }
});

// Judges & Login
app.post("/api/judges/login", async (req, res) => {
  try {
    const { code, competition_id } = req.body;
    if (!code || !competition_id) return res.status(400).json({ error: "Thiếu thông tin" });
    const snap = await db.collection("judges")
      .where("code", "==", code.trim())
      .where("competition_id", "==", competition_id)
      .limit(1).get();
    if (!snap.empty) res.json({ id: snap.docs[0].id, ...snap.docs[0].data() });
    else res.status(401).json({ error: "Mã giám khảo không đúng" });
  } catch (error) { res.status(500).json({ error: "Login failed" }); }
});

// Scores (Cập nhật logic kiểm tra khóa kép: nội dung & hội thi)
app.post("/api/scores/bulk", async (req, res) => {
  try {
    const { scores } = req.body;
    if (!Array.isArray(scores)) return res.status(400).json({ error: "Invalid data" });

    for (let i = 0; i < scores.length; i += 500) {
      const chunk = scores.slice(i, i + 500);
      const batch = db.batch();
      for (const s of chunk) {
        const eventDoc = await db.collection("events").doc(s.event_id).get();
        if (!eventDoc.exists || eventDoc.data()?.is_locked) continue;
        
        const compId = eventDoc.data()?.competition_id;
        if (compId) {
          const compDoc = await db.collection("competitions").doc(compId).get();
          if (compDoc.exists && compDoc.data()?.is_locked) continue;
        }

        const query = db.collection("scores")
          .where("class_id", "==", s.class_id).where("event_id", "==", s.event_id)
          .where("judge_id", "==", s.judge_id).where("round", "==", s.round);
        const existing = await query.get();
        
        const targetDoc = existing.docs.find(d => d.data().category === s.category || (!d.data().category && !s.category));
        if (targetDoc) batch.update(targetDoc.ref, { score: s.score });
        else batch.set(db.collection("scores").doc(), { ...s, category: s.category || null });
      }
      await batch.commit();
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error bulk saving scores" }); }
});

app.post("/api/scores", async (req, res) => {
  try {
    const { class_id, event_id, judge_id, round, score, category } = req.body;
    const eventDoc = await db.collection("events").doc(event_id).get();
    if (!eventDoc.exists || eventDoc.data()?.is_locked) return res.status(403).json({ error: "Nội dung đã bị khóa" });
    
    const compDoc = await db.collection("competitions").doc(eventDoc.data()?.competition_id).get();
    if (compDoc.exists && compDoc.data()?.is_locked) return res.status(403).json({ error: "Hội thi đã bị khóa" });

    const existing = await db.collection("scores").where("class_id", "==", class_id).where("event_id", "==", event_id).where("judge_id", "==", judge_id).where("round", "==", round).get();
    const targetDoc = existing.docs.find(d => d.data().category === category || (!d.data().category && !category));
    
    if (targetDoc) await targetDoc.ref.update({ score });
    else await db.collection("scores").add({ class_id, event_id, judge_id, round, score, category: category || null });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error saving score" }); }
});

// Lockings & Conversions (Giữ nguyên)
app.post("/api/events/:id/lock", async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).update({ is_locked: !!req.body.is_locked });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error locking event" }); }
});

app.post("/api/conversions", async (req, res) => {
  try {
    const snap = await db.collection("conversions").get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    req.body.conversions.forEach((c: any) => batch.set(db.collection("conversions").doc(), { rank: c.rank, points: c.points }));
    await batch.commit();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error saving conversions" }); }
});

// --- VERCEL EXPORT ---
export default app;
