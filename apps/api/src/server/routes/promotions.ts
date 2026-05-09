import { Router } from "express";
import { getPromotionsQuerySchema } from "@promo/shared";
import { listPromotions, getPromotionById } from "../../db/promotions.js";

export const promotionsRouter = Router();

promotionsRouter.get("/", (req, res) => {
  const parsed = getPromotionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query",
      issues: parsed.error.issues,
    });
    return;
  }
  const result = listPromotions(parsed.data);
  res.json(result);
});

promotionsRouter.get("/:id", (req, res) => {
  const promo = getPromotionById(req.params.id);
  if (!promo) {
    res.status(404).json({ error: "Promotion not found" });
    return;
  }
  res.json(promo);
});