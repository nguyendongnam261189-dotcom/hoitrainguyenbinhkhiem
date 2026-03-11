import express from "express";
import admin from "firebase-admin";

// 1. Cấu hình Firebase Admin (Tối ưu cho Serverless)
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

// Helper để lấy dữ liệu Firestore (giữ nguyên logic của bạn)
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
    const docRef = await db.collection("competitions").add({ name, date });
    res.json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi tạo hội thi trên Firebase" });
  }
});

app.get("/api/competitions/:id/full", async (req, res) => {
  try {
    const { id } = req.params;
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
      const scorePromises = [];
      for (let i = 0; i < eventIds.length; i += 10) {
        const chunk = eventIds.slice(i, i + 10);
        scorePromises.push(db.collection("scores").where("event_id", "in", chunk).get());
      }
      const scoreSnaps = await Promise.all(scorePromises);
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

// Reorder
app.post("/api/reorder", async (req, res) => {
  try {
    const { collection, items } = req.body;
    if (!collection || !items || !Array.isArray(items)) return res.status(400).json({ error: "Invalid data" });
    const batch = db.batch();
    items.forEach((item: any) => {
      const ref = db.collection(collection).doc(item.id);
      batch.update(ref, { order: item.order });
    });
    await batch.commit();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error reordering items" });
  }
});

// Classes
app.post("/api/classes", async (req, res) => {
  try {
    const { name, grade, competition_id, order } = req.body;
    const docRef = await db.collection("classes").add({ name, grade, competition_id, order: order || 0 });
    res.json({ id: docRef.id });
  } catch (error) { res.status(500).json({ error: "Error creating class" }); }
});

app.put("/api/classes/:id", async (req, res) => {
  try {
    const { name, grade } = req.body;
    await db.collection("classes").doc(req.params.id).update({ name, grade });
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

// Events
app.post("/api/events", async (req, res) => {
  try {
    const { name, competition_id, type, round_count, weight, order, round_names } = req.body;
    const docRef = await db.collection("events").add({ name, competition_id, type, round_count, weight, is_locked: false, order: order || 0, round_names: round_names || [] });
    res.json({ id: docRef.id });
  } catch (error) { res.status(500).json({ error: "Error creating event" }); }
});

app.put("/api/events/:id", async (req, res) => {
  try {
    const { name, type, round_count, weight, round_names } = req.body;
    await db.collection("events").doc(req.params.id).update({ name, type, round_count, weight, round_names: round_names || [] });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error updating event" }); }
});

app.delete("/api/events/:id", async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).delete();
    const scoresSnap = await db.collection("scores").where("event_id", "==", req.params.id).get();
    const batch = db.batch();
    scoresSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error deleting event" }); }
});

// Judges
app.post("/api/judges", async (req, res) => {
  try {
    const { name, code, competition_id, order } = req.body;
    const docRef = await db.collection("judges").add({ name, code, competition_id, order: order || 0 });
    res.json({ id: docRef.id });
  } catch (error) { res.status(500).json({ error: "Error creating judge" }); }
});

app.put("/api/judges/:id", async (req, res) => {
  try {
    const { name, code } = req.body;
    await db.collection("judges").doc(req.params.id).update({ name, code });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error updating judge" }); }
});

app.delete("/api/judges/:id", async (req, res) => {
  try {
    await db.collection("judges").doc(req.params.id).delete();
    const scoresSnap = await db.collection("scores").where("judge_id", "==", req.params.id).get();
    const batch = db.batch();
    scoresSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error deleting judge" }); }
});

// Judge Login (Sửa theo code mới của bạn)
app.post("/api/judges/login", async (req, res) => {
  try {
    const { code, competition_id } = req.body;
    if (!code || !competition_id) return res.status(400).json({ error: "Thiếu mã hoặc ID hội thi" });

    const snap = await db.collection("judges")
      .where("code", "==", code.trim())
      .where("competition_id", "==", competition_id)
      .limit(1).get();
    
    if (!snap.empty) {
      res.json({ id: snap.docs[0].id, ...snap.docs[0].data() });
    } else {
      res.status(401).json({ error: "Mã giám khảo không đúng" });
    }
  } catch (error) { res.status(500).json({ error: "Lỗi hệ thống đăng nhập" }); }
});

// Scores Bulk
app.post("/api/scores/bulk", async (req, res) => {
  try {
    const { scores } = req.body;
    if (!Array.isArray(scores)) return res.status(400).json({ error: "Invalid data" });

    for (let i = 0; i < scores.length; i += 500) {
      const chunk = scores.slice(i, i + 500);
      const batch = db.batch();
      for (const s of chunk) {
        const { class_id, event_id, judge_id, round, score, category } = s;
        const query = db.collection("scores")
          .where("class_id", "==", class_id)
          .where("event_id", "==", event_id)
          .where("judge_id", "==", judge_id)
          .where("round", "==", round)
          .where("category", "==", category || null);
        const snap = await query.get();
        if (!snap.empty) { batch.update(snap.docs[0].ref, { score }); }
        else { const ref = db.collection("scores").doc(); batch.set(ref, { ...s, category: category || null }); }
      }
      await batch.commit();
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error saving bulk scores" }); }
});

// Locking
app.post("/api/events/:id/lock", async (req, res) => {
  try {
    await db.collection("events").doc(req.params.id).update({ is_locked: !!req.body.is_locked });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error locking event" }); }
});

app.post("/api/events/lock-all", async (req, res) => {
  try {
    const snap = await db.collection("events").where("competition_id", "==", req.body.competition_id).get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.update(doc.ref, { is_locked: !!req.body.is_locked }));
    await batch.commit();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error locking all" }); }
});

// Conversions
app.get("/api/conversions", async (req, res) => {
  try { res.json(await getDocs("conversions", ref => ref.orderBy("rank"))); }
  catch (error) { res.status(500).json({ error: "Error fetching conversions" }); }
});

app.post("/api/conversions", async (req, res) => {
  try {
    const snap = await db.collection("conversions").get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    req.body.conversions.forEach((c: any) => {
      const ref = db.collection("conversions").doc();
      batch.set(ref, { rank: c.rank, points: c.points });
    });
    await batch.commit();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Error saving conversions" }); }
});

// --- CẤU HÌNH VERCEL (KHÔNG THAY ĐỔI) ---
// Vercel tự động phục vụ file tĩnh nên không cần app.use(static) hay app.get(*) ở đây.
export default app;
