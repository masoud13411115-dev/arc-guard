import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lanRouter    from "./lan";
import notifyRouter from "./notify";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lanRouter);
router.use(notifyRouter);

export default router;
