import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (projectId && clientEmail && privateKey) {
  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
    console.error("FIREBASE_PRIVATE_KEY format is invalid. It should start with '-----BEGIN PRIVATE KEY-----'");
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  console.log("Firebase Admin initialized successfully");
} else {
  console.warn("Firebase credentials missing. Application may not function correctly.");
}

const db = admin.firestore();

// Helper to get collection data with IDs
const getDocs = async (collection: string, query?: (ref: admin.firestore.CollectionReference) => admin.firestore.Query) => {
  let ref: admin.firestore.Query = db.collection(collection);
  if (query) ref = query(db.collection(collection));
  const snapshot = await ref.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const app = express();
const PORT = 3000;

app.use(express.json());

// API Routes
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
      if (!name || !date) {
        return res.status(400).json({ error: "Thiếu tên hoặc ngày tổ chức" });
      }
      
      if (!projectId || !clientEmail || !privateKey) {
        return res.status(500).json({ error: "Cấu hình Firebase chưa hoàn tất. Vui lòng kiểm tra lại các biến môi trường (Secrets)." });
      }

      const docRef = await db.collection("competitions").add({ name, date });
      res.json({ id: docRef.id });
    } catch (error: any) {
      console.error("Firebase Error:", error);
      let message = "Lỗi khi tạo hội thi trên Firebase";
      if (error.message?.includes("Cloud Firestore API has not been used")) {
        message = "Bạn chưa kích hoạt Firestore Database trong Firebase Console. Vui lòng vào mục Firestore và nhấn 'Create Database'.";
      } else if (error.code === 16 || error.message?.includes("Unauthenticated")) {
        message = "Thông tin xác thực Firebase không chính xác. Vui lòng kiểm tra lại Private Key và Client Email.";
      }
      res.status(500).json({ error: message, details: error.message });
    }
  });

  app.get("/api/competitions/:id/full", async (req, res) => {
    try {
      const id = req.params.id;
      const compDoc = await db.collection("competitions").doc(id).get();
      if (!compDoc.exists) return res.status(404).json({ error: "Competition not found" });
      
      const competition = { id: compDoc.id, ...compDoc.data() };
      
      const [classes, events, judges, conversions] = await Promise.all([
        getDocs("classes", ref => ref.where("competition_id", "==", id)),
        getDocs("events", ref => ref.where("competition_id", "==", id)),
        getDocs("judges", ref => ref.where("competition_id", "==", id)),
        getDocs("conversions", ref => ref.orderBy("rank"))
      ]);

      // Sort by order if exists, else by name/rank
      const sortItems = (items: any[]) => {
        return items.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
          if (a.name && b.name) return a.name.localeCompare(b.name, undefined, { numeric: true });
          return 0;
        });
      };

      // Fetch scores for all events of this competition
      const eventIds = events.map(e => e.id);
      let scores: any[] = [];
      if (eventIds.length > 0) {
        // Firestore 'in' query limited to 10 items, but we can just fetch all scores and filter if needed
        // Or better: fetch scores where event_id is in eventIds (chunked if > 10)
        const scorePromises = [];
        for (let i = 0; i < eventIds.length; i += 10) {
          const chunk = eventIds.slice(i, i + 10);
          scorePromises.push(db.collection("scores").where("event_id", "in", chunk).get());
        }
        const scoreSnapshots = await Promise.all(scorePromises);
        scores = scoreSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }

      res.json({ 
        competition, 
        classes: sortItems(classes), 
        events: sortItems(events), 
        judges: sortItems(judges), 
        scores, 
        conversions 
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error fetching full data" });
    }
  });

  app.post("/api/reorder", async (req, res) => {
    try {
      const { collection, items } = req.body; // items: [{id, order}]
      if (!collection || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: "Invalid reorder data" });
      }

      const batch = db.batch();
      items.forEach((item: any) => {
        const ref = db.collection(collection).doc(item.id);
        batch.update(ref, { order: item.order });
      });
      await batch.commit();
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error reordering items" });
    }
  });

  app.post("/api/classes", async (req, res) => {
    try {
      const { name, grade, competition_id, order } = req.body;
      const docRef = await db.collection("classes").add({ name, grade, competition_id, order: order || 0 });
      res.json({ id: docRef.id });
    } catch (error) {
      res.status(500).json({ error: "Error creating class" });
    }
  });

  app.put("/api/classes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, grade } = req.body;
      await db.collection("classes").doc(id).update({ name, grade });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error updating class" });
    }
  });

  app.delete("/api/classes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection("classes").doc(id).delete();
      // Delete scores for this class
      const scoresSnap = await db.collection("scores").where("class_id", "==", id).get();
      const batch = db.batch();
      scoresSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error deleting class" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const { name, competition_id, type, round_count, weight, order, round_names } = req.body;
      const docRef = await db.collection("events").add({ 
        name, competition_id, type, round_count, weight, is_locked: false, order: order || 0,
        round_names: round_names || []
      });
      res.json({ id: docRef.id });
    } catch (error) {
      res.status(500).json({ error: "Error creating event" });
    }
  });

  app.put("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, type, round_count, weight, round_names } = req.body;
      await db.collection("events").doc(id).update({ 
        name, type, round_count, weight, round_names: round_names || []
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error updating event" });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection("events").doc(id).delete();
      // Delete scores for this event
      const scoresSnap = await db.collection("scores").where("event_id", "==", id).get();
      const batch = db.batch();
      scoresSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error deleting event" });
    }
  });

  app.post("/api/judges", async (req, res) => {
    try {
      const { name, code, competition_id, order } = req.body;
      const docRef = await db.collection("judges").add({ name, code, competition_id, order: order || 0 });
      res.json({ id: docRef.id });
    } catch (error) {
      res.status(500).json({ error: "Error creating judge" });
    }
  });

  app.put("/api/judges/:id", async (req, res) => {
    try {
      const { name, code } = req.body;
      await db.collection("judges").doc(req.params.id).update({ name, code });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error updating judge" });
    }
  });

  app.delete("/api/judges/:id", async (req, res) => {
    try {
      const id = req.params.id;
      await db.collection("judges").doc(id).delete();
      const scoresSnap = await db.collection("scores").where("judge_id", "==", id).get();
      const batch = db.batch();
      scoresSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error deleting judge" });
    }
  });

  app.post("/api/judges/login", async (req, res) => {
    try {
      const { code, competition_id } = req.body;
      const snap = await db.collection("judges")
        .where("code", "==", code)
        .where("competition_id", "==", competition_id)
        .limit(1)
        .get();
      
      if (!snap.empty) {
        const doc = snap.docs[0];
        res.json({ id: doc.id, ...doc.data() });
      } else {
        res.status(401).json({ error: "Mã giám khảo không đúng hoặc không thuộc hội thi này" });
      }
    } catch (error) {
      res.status(500).json({ error: "Error logging in" });
    }
  });

  app.post("/api/scores/bulk", async (req, res) => {
    try {
      const { scores } = req.body;
      if (!scores || !Array.isArray(scores)) {
        return res.status(400).json({ error: "Invalid scores data" });
      }

      // Process in chunks of 500 (Firestore batch limit)
      for (let i = 0; i < scores.length; i += 500) {
        const chunk = scores.slice(i, i + 500);
        const batch = db.batch();
        
        for (const s of chunk) {
          const { class_id, event_id, judge_id, round, score, category } = s;
          
          // Check if event is locked
          const eventDoc = await db.collection("events").doc(event_id).get();
          if (eventDoc.exists && eventDoc.data()?.is_locked) continue;

          // Find existing score
          let query = db.collection("scores")
            .where("class_id", "==", class_id)
            .where("event_id", "==", event_id)
            .where("judge_id", "==", judge_id)
            .where("round", "==", round);
          
          if (category) {
            query = query.where("category", "==", category);
          } else {
            // Firestore doesn't support where("category", "==", null) easily if field is missing
            // We'll assume category is either a string or undefined/null
          }

          const existingSnap = await query.get();
          
          // Filter for null category if needed (Firestore query above might not be perfect for nulls)
          const existingDoc = existingSnap.docs.find(doc => {
            const data = doc.data();
            return data.category === category || (!data.category && !category);
          });

          if (existingDoc) {
            batch.update(existingDoc.ref, { score });
          } else {
            const newRef = db.collection("scores").doc();
            batch.set(newRef, { class_id, event_id, judge_id, round, score, category: category || null });
          }
        }
        await batch.commit();
      }
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Lỗi khi lưu điểm hàng loạt" });
    }
  });

  app.post("/api/scores", async (req, res) => {
    try {
      const { class_id, event_id, judge_id, round, score, category } = req.body;
      
      const eventDoc = await db.collection("events").doc(event_id).get();
      if (eventDoc.exists && eventDoc.data()?.is_locked) {
        return res.status(403).json({ error: "Event is locked" });
      }

      let query = db.collection("scores")
        .where("class_id", "==", class_id)
        .where("event_id", "==", event_id)
        .where("judge_id", "==", judge_id)
        .where("round", "==", round);
      
      const existingSnap = await query.get();
      const existingDoc = existingSnap.docs.find(doc => {
        const data = doc.data();
        return data.category === category || (!data.category && !category);
      });

      if (existingDoc) {
        await existingDoc.ref.update({ score });
      } else {
        await db.collection("scores").add({ class_id, event_id, judge_id, round, score, category: category || null });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error saving score" });
    }
  });

  app.post("/api/events/:id/lock", async (req, res) => {
    try {
      const { is_locked } = req.body;
      await db.collection("events").doc(req.params.id).update({ is_locked: !!is_locked });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error locking event" });
    }
  });

  app.post("/api/events/lock-all", async (req, res) => {
    try {
      const { competition_id, is_locked } = req.body;
      const snap = await db.collection("events").where("competition_id", "==", competition_id).get();
      const batch = db.batch();
      snap.docs.forEach(doc => batch.update(doc.ref, { is_locked: !!is_locked }));
      await batch.commit();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error locking all events" });
    }
  });

  app.get("/api/conversions", async (req, res) => {
    try {
      const rows = await getDocs("conversions", ref => ref.orderBy("rank"));
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Error fetching conversions" });
    }
  });

  app.post("/api/conversions", async (req, res) => {
    try {
      const { conversions } = req.body;
      const snap = await db.collection("conversions").get();
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      
      conversions.forEach((c: any) => {
        const ref = db.collection("conversions").doc();
        batch.set(ref, { rank: c.rank, points: c.points });
      });
      
      await batch.commit();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error saving conversions" });
    }
  });

  // Vite/Static middleware
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

export default app;
