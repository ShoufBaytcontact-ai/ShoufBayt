import express from "express";
import { placeQuery } from "../controllers/geo.controller.js";
import { shouldBeLoggedIN } from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/place", shouldBeLoggedIN, placeQuery);

export default router;
