import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import produitsRouter from "./produits";
import fournisseursRouter from "./fournisseurs";
import devisRouter from "./devis";
import projetsRouter from "./projets";
import facturesRouter from "./factures";
import atelierRouter from "./atelier";
import storageRouter from "./storage";
import importRouter from "./import";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(produitsRouter);
router.use(fournisseursRouter);
router.use(devisRouter);
router.use(projetsRouter);
router.use(facturesRouter);
router.use(atelierRouter);
router.use(storageRouter);
router.use(importRouter);

export default router;
