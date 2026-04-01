import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import produitsRouter from "./produits";
import devisRouter from "./devis";
import facturesRouter from "./factures";
import atelierRouter from "./atelier";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(produitsRouter);
router.use(devisRouter);
router.use(facturesRouter);
router.use(atelierRouter);

export default router;
