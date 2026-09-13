import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { getAuthenticatedClient } from "../lib/googleOAuth";
import { google } from "googleapis";

const router: IRouter = Router();

// GET /api/classroom/courses – list active courses
router.get("/classroom/courses", requireAuth, async (req, res) => {
  const clerkUserId = (req as AuthenticatedRequest).userId;
  const authClient = await getAuthenticatedClient(clerkUserId);
  if (!authClient) {
    res.status(503).json({ error: "Google not connected" });
    return;
  }
  const classroom = google.classroom({ version: "v1", auth: authClient });
  try {
    const response = await classroom.courses.list({ courseStates: ["ACTIVE"] });
    const courses = (response.data.courses ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      section: c.section,
      descriptionHeading: c.descriptionHeading,
    }));
    res.json({ courses });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// GET /api/classroom/sync – combined feed
router.get("/classroom/sync", requireAuth, async (req, res) => {
  const clerkUserId = (req as AuthenticatedRequest).userId;
  const authClient = await getAuthenticatedClient(clerkUserId);
  if (!authClient) {
    res.status(503).json({ error: "Google not connected" });
    return;
  }
  const classroom = google.classroom({ version: "v1", auth: authClient });
  try {
    const coursesResp = await classroom.courses.list({ courseStates: ["ACTIVE"] });
    const courses = (coursesResp.data.courses ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      section: c.section,
      descriptionHeading: c.descriptionHeading,
    }));

    const announcements: Array<{
      id: string | undefined;
      title: string | undefined;
      description: string | undefined;
      creationTime: string | undefined;
      courseId: string | undefined;
    }> = [];
    const coursework: Array<{
      id: string | undefined;
      title: string | undefined;
      description: string | undefined;
      dueDate: any;
      courseId: string | undefined;
    }> = [];

    for (const course of courses) {
      if (!course.id) continue;
      // Announcements
      const annResp = await classroom.courses.announcements.list({
        courseId: course.id,
        pageSize: 20,
      });
      (annResp.data.announcements ?? []).forEach((a) => {
        announcements.push({
          id: a.id,
          title: a.title,
          description: a.description,
          creationTime: a.creationTime,
          courseId: a.courseId,
        });
      });
      // Coursework
      const cwResp = await classroom.courses.courseWork.list({
        courseId: course.id,
        pageSize: 20,
      });
      (cwResp.data.courseWork ?? []).forEach((c) => {
        coursework.push({
          id: c.id,
          title: c.title,
          description: c.description,
          dueDate: c.dueDate,
          courseId: c.courseId,
        });
      });
    }

    res.json({ courses, announcements, coursework });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to sync classroom" });
  }
});

export default router;
