import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountRouter from "./account";
import calendarRouter from "./calendar";
import gmailRouter from "./gmail";
import familyRouter from "./family";
import whatsappRouter from "./whatsapp";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountRouter);
router.use(calendarRouter);
router.use(gmailRouter);
router.use(familyRouter);
router.use(whatsappRouter);
router.use(aiRouter);

export default router;
