import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/generate-3d/:id", async (req, res) => {
  const postId = req.params.id;

  try {
    // 1. Get property from DB (fake example)
    const post = await getPostFromDB(postId);

    // 2. Call AI (Meshy example)
    const aiResponse = await axios.post(
      "https://api.meshy.ai/v1/generate",
      {
        images: post.images,
        style: "realistic"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MESHY_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const modelUrl = aiResponse.data.model_url;

    // 3. Save in DB
    await updatePost(postId, {
      aiModelUrl: modelUrl,
      aiStatus: "done"
    });

    res.json({ modelUrl });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "3D generation failed" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));