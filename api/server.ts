import express from "express";
import admin from "firebase-admin";
import path from "path";

// 1. Khởi tạo Firebase Admin (Tối ưu cho Serverless)
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

// Helper lấy dữ liệu Firestore
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
  if (password === correctPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Mật khẩu không chính xác" });
  }
});

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
    if (!name || !date) return res.status(400).json({ error: "Thiếu tên hoặc ngày" });
    const docRef = await db.collection("competitions").add({ name, date });
    res.json({ id: docRef.id });
  } catch (error) {
    res.status(500).json({ error: "Error creating competition" });
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

    const sortItems = (items: any[]) => items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

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

app.post("/api/scores/bulk", async (req, res) => {
  try {
    const { scores } = req.body;
    if (!Array.isArray(scores)) return res.status(400).json({ error: "Invalid data" });

    const batch = db.batch();
    for (const s of scores) {
      const { class_id, event_id, judge_id, round, score, category } = s;
      const query = db.collection("scores")
        .where("class_id", "==", class_id)
        .where("event_id", "==", event_id)
        .where("judge_id", "==", judge_id)
        .where("round", "==", round)
        .where("category", "==", category || null);

      const snap = await query.get();
      if (!snap.empty) {
        batch.update(snap.docs[0].ref, { score });
      } else {
        const newRef = db.collection("scores").doc();
        batch.set(newRef, { class_id, event_id, judge_id, round, score, category: category || null });
      }
    }
    await batch.commit();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error saving bulk scores" });
  }
});

// Thêm các route khác (classes, judges, events...) tương tự cấu trúc trên nếu cần

// --- QUAN TRỌNG: Cấu hình cho Vercel ---
// Chúng ta không dùng app.listen() và không dùng Vite middleware ở đây.
// Vercel sẽ tự động handle object 'app' này.

export default app;
