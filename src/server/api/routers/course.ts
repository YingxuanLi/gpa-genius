import { and, sql } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { courses } from "~/server/db/schema";
import { getCourseAndAssessments } from "~/server/utils/courseScraper";

type courseInput = typeof courses.$inferInsert;
export const legacyAssessmentDetailsSchema = z.object({
  task: z.string(),
  dueDate: z.string().optional(),
  weight: z.string(),
  objectives: z.string().optional(),
});

export const assessmentDetailSchema = z.object({
  title: z.string(),
  mode: z.string().optional(),
  category: z.string().optional(),
  weight: z.string(),
  dueDate: z.string().optional(),
  taskDescription: z.string().optional(),
  learningOutcomes: z.string().optional(),
  hurdleRequirements: z.string().optional(),
  additionalDetails: z.record(z.string()).optional(),
  isHurdled: z.boolean().optional(),
});

const insertCourse = async ({
  ctx,
  input,
}: {
  ctx: any;
  input: courseInput;
}) => {
  const course = await ctx.db
    .insert(courses)
    .values({
      courseCode: input.courseCode,
      courseName: input.courseName,
      year: input.year,
      semester: input.semester,
      credit: input.credit,
      universityId: input.universityId,
      description: input.description,
      assessments: input.assessments,
      createdBy: input.createdBy || ctx.session.user.id, // Assuming user ID is stored in session
    })
    .returning();
  return course;
};

// Define the tRPC router for courses
export const courseRouter = createTRPCRouter({
  // Create a new course (protected route)
  create: protectedProcedure
    .input(
      z.object({
        universityId: z.string().uuid(),
        courseCode: z.string().min(1).max(64),
        courseName: z.string().min(1).max(255),
        semester: z.string().min(1).max(255),
        year: z.number(),
        credit: z.number().min(0),
        description: z.string().optional(),
        assessments: z.array(assessmentDetailSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const course = await insertCourse({ ctx, input });
      return course ?? null;
    }),
  insertParsedCourse: publicProcedure
    .input(
      z.object({
        universityId: z.string().uuid().optional(),
        courseCode: z.string(),
        year: z.number(),
        semester: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const universityId = ctx.session?.user.universityId || input.universityId;
      if (!universityId) {
        throw Error("University ID is required!");
      }
      const { courseName, courseCode, units, assessments } =
        await getCourseAndAssessments(
          input.courseCode,
          input.semester,
          input.year.toString(),
        );
      const formattedInput = {
        universityId,
        courseCode: courseCode ? courseCode : input.courseCode,
        courseName,
        credit: Number(units),
        assessments,
        year: input.year,
        semester: input.semester,
        createdBy: "system",
        updatedBy: "system",
      };
      const course = await insertCourse({ ctx, input: formattedInput });
      return course ?? null;
    }),

  getAllCoursesByUniversity: publicProcedure
    .input(z.object({ universityId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const universityId = ctx.session?.user.universityId || input.universityId;
      if (!universityId) {
        throw Error("UniversityId is required");
      }
      const courses = await ctx.db.query.courses.findMany({
        columns: {
          id: true,
          courseCode: true,
          courseName: true,
          description: true,
          credit: true,
        },
        where: (course, { eq }) =>
          and(
            eq(course.createdBy, "system"),
            eq(course.universityId, universityId),
          ),
      });
      return courses ?? null;
    }),
  getCourseById: publicProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const course = await ctx.db.query.courses.findFirst({
        where: (courses, { eq }) => eq(courses.id, input.courseId),
      });
      return course ?? null;
    }),
  getCourseByCodeAndSemester: publicProcedure
    .input(
      z.object({
        universityId: z.string().uuid().optional(),
        courseCode: z.string(),
        year: z.number(),
        semester: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.session?.user?.universityId && !input.universityId) {
        throw new Error("universityId is required");
      }

      const universityId =
        ctx?.session?.user.universityId ||
        (ctx?.headers.get("universityId") as string) ||
        input.universityId!;

      let course = await ctx.db.query.courses.findFirst({
        where: (courses, { eq, and }) =>
          and(
            eq(courses.universityId, universityId),
            eq(courses.courseCode, input.courseCode),
            eq(courses.year, input.year),
            eq(courses.semester, input.semester),
          ),
      });
      return course ?? null;
    }),
  autocomplete: publicProcedure
    .input(
      z.object({
        searchTerm: z.string(),
        universityId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.session?.user?.universityId && !input.universityId) {
        throw new Error("universityId is required");
      }

      const universityId =
        ctx?.session?.user.universityId ||
        (ctx?.headers.get("universityId") as string) ||
        input.universityId!;

      if (!input.searchTerm) {
        throw new Error("searchTerm is required for autocomplete");
      }

      const match = await ctx.db.execute(
        sql.raw(
          `SELECT id, course_name, course_code FROM course 
           WHERE university_id = '${universityId}'
           and fts @@ to_tsquery('${input.searchTerm}:*');`,
        ),
      );
      const matchedCourses = match.map((c) => {
        return {
          id: c.id as string,
          courseCode: c.course_code as string,
          courseName: c.course_name as string,
        };
      });

      return matchedCourses ?? [];
    }),
});
