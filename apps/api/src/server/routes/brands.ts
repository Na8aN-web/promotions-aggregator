import { Router } from "express";
import { listBrandsWithCount } from "../../db/brands.js";

export const brandsRouter = Router();

brandsRouter.get("/", (_req, res) => {
  res.json({ items: listBrandsWithCount() });
});