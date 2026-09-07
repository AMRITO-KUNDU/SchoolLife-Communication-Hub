import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountRouter from "./account";
import calendarRouter from "./calendar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountRouter);
router.use(calendarRouter);

export default router;
