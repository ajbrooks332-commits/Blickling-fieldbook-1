import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import locationsRouter from "./locations";
import observationsRouter from "./observations";
import actionsRouter from "./actions";
import notesRouter from "./notes";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import storageRouter from "./storage";
import imagesRouter from "./images";
import resetRouter from "./reset";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use("/auth", authRouter);
router.use(usersRouter);
router.use(categoriesRouter);
router.use("/locations", locationsRouter);
router.use("/observations", observationsRouter);
router.use("/actions", actionsRouter);
router.use("/notes", notesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/reports", reportsRouter);
router.use(imagesRouter);
router.use(resetRouter);

export default router;
