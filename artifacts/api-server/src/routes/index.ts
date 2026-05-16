import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lanRouter    from "./lan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lanRouter);

export default router;
