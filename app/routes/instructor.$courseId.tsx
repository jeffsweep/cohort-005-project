import { useState, useEffect } from "react";
import { Link, useFetcher } from "react-router";
import { toast } from "sonner";
import type { DropResult } from "@hello-pangea/dnd";
import type { Route } from "./+types/instructor.$courseId";
import { coursePermissions } from "~/modules/permissions/course-permissions.server";
import { CourseStatus } from "~/db/schema";
import {
  getCourseWithDetails,
  getLessonCountForCourse,
} from "~/lib/course-editor.server";
import { handleCourseEditorIntent } from "~/lib/course-editor-action.server";
import {
  getEnrollmentCountForCourse,
  getStudentRoster,
} from "~/lib/course-roster.server";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  ArrowLeft,
  BookOpen,
  Settings,
  Users,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import { CourseContentEditor } from "~/components/course-editor/course-content-editor";
import { CourseSettings } from "~/components/course-editor/course-settings";
import { InlineEditableDescription } from "~/components/course-editor/inline-editable-description";
import { InlineEditableTitle } from "~/components/course-editor/inline-editable-title";
import { SalesCopyEditor } from "~/components/course-editor/sales-copy-editor";
import { StudentRoster } from "~/components/course-editor/student-roster";

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Edit Course";
  return [
    { title: `Edit: ${title} — Cadence` },
    { name: "description", content: `Edit course: ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const {
    course: { id: courseId },
  } = await coursePermissions.requireCapability(request, "manage", {
    courseId: params.courseId,
  });

  const course = getCourseWithDetails(courseId);
  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  const lessonCount = getLessonCountForCourse(courseId);
  const enrollmentCount = getEnrollmentCountForCourse(courseId);

  const { students, quizCount } = getStudentRoster(
    courseId,
    course.modules.flatMap((mod) => mod.lessons)
  );

  return { course, lessonCount, enrollmentCount, students, quizCount };
}

export async function action({ params, request }: Route.ActionArgs) {
  const { course } = await coursePermissions.requireCapability(
    request,
    "manage",
    { courseId: params.courseId }
  );

  return handleCourseEditorIntent(course, await request.formData());
}

function statusBadgeColor(status: string) {
  switch (status) {
    case CourseStatus.Published:
      return "text-green-800 dark:text-green-400";
    case CourseStatus.Draft:
      return "text-yellow-800 dark:text-yellow-400";
    case CourseStatus.Archived:
      return "text-gray-800 dark:text-gray-400";
    default:
      return "";
  }
}

export default function InstructorCourseEditor({
  loaderData,
}: Route.ComponentProps) {
  const { course, lessonCount, enrollmentCount, students, quizCount } =
    loaderData;
  const statusFetcher = useFetcher();
  const reorderFetcher = useFetcher();
  const lessonReorderFetcher = useFetcher();
  const salesCopyFetcher = useFetcher();
  const priceFetcher = useFetcher();
  const pppFetcher = useFetcher();

  const [salesCopy, setSalesCopy] = useState<string>(course.salesCopy);

  useEffect(() => {
    if (statusFetcher.state === "idle" && statusFetcher.data?.success) {
      toast.success("Course status updated.");
    }
    if (statusFetcher.state === "idle" && statusFetcher.data?.error) {
      toast.error(statusFetcher.data.error);
    }
  }, [statusFetcher.state, statusFetcher.data]);

  useEffect(() => {
    if (reorderFetcher.state === "idle" && reorderFetcher.data?.success) {
      toast.success("Modules reordered.");
    }
    if (reorderFetcher.state === "idle" && reorderFetcher.data?.error) {
      toast.error(reorderFetcher.data.error);
    }
  }, [reorderFetcher.state, reorderFetcher.data]);

  useEffect(() => {
    if (
      lessonReorderFetcher.state === "idle" &&
      lessonReorderFetcher.data?.success
    ) {
      toast.success("Lessons reordered.");
    }
    if (
      lessonReorderFetcher.state === "idle" &&
      lessonReorderFetcher.data?.error
    ) {
      toast.error(lessonReorderFetcher.data.error);
    }
  }, [lessonReorderFetcher.state, lessonReorderFetcher.data]);

  useEffect(() => {
    if (salesCopyFetcher.state === "idle" && salesCopyFetcher.data?.success) {
      toast.success("Sales copy saved.");
    }
    if (salesCopyFetcher.state === "idle" && salesCopyFetcher.data?.error) {
      toast.error(salesCopyFetcher.data.error);
    }
  }, [salesCopyFetcher.state, salesCopyFetcher.data]);

  useEffect(() => {
    if (priceFetcher.state === "idle" && priceFetcher.data?.success) {
      toast.success("Price updated.");
    }
    if (priceFetcher.state === "idle" && priceFetcher.data?.error) {
      toast.error(priceFetcher.data.error);
    }
  }, [priceFetcher.state, priceFetcher.data]);

  useEffect(() => {
    if (pppFetcher.state === "idle" && pppFetcher.data?.success) {
      toast.success("PPP setting updated.");
    }
    if (pppFetcher.state === "idle" && pppFetcher.data?.error) {
      toast.error(pppFetcher.data.error);
    }
  }, [pppFetcher.state, pppFetcher.data]);

  function handleSalesCopySave() {
    salesCopyFetcher.submit(
      { intent: "update-sales-copy", salesCopy },
      { method: "post" }
    );
  }

  function handleStatusChange(newStatus: string) {
    statusFetcher.submit(
      { intent: "update-status", status: newStatus },
      { method: "post" }
    );
  }

  function handlePriceChange(price: string) {
    priceFetcher.submit({ intent: "update-price", price }, { method: "post" });
  }

  function handlePppToggle() {
    pppFetcher.submit(
      {
        intent: "update-ppp-enabled",
        pppEnabled: String(!course.pppEnabled),
      },
      { method: "post" }
    );
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (
      result.source.droppableId === result.destination.droppableId &&
      result.source.index === result.destination.index
    ) {
      return;
    }

    if (result.type === "module") {
      const reordered = Array.from(course.modules);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);

      const moduleIds = reordered.map((m) => m.id);
      reorderFetcher.submit(
        { intent: "reorder-modules", moduleIds: JSON.stringify(moduleIds) },
        { method: "post" }
      );
    } else if (result.type === "lesson") {
      const sourceModuleId = parseInt(
        result.source.droppableId.replace("lessons-", ""),
        10
      );
      const destModuleId = parseInt(
        result.destination.droppableId.replace("lessons-", ""),
        10
      );

      if (sourceModuleId === destModuleId) {
        // Reorder within the same module
        const mod = course.modules.find((m) => m.id === sourceModuleId);
        if (!mod) return;

        const reordered = Array.from(mod.lessons);
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);

        const lessonIds = reordered.map((l) => l.id);
        lessonReorderFetcher.submit(
          {
            intent: "reorder-lessons",
            moduleId: String(sourceModuleId),
            lessonIds: JSON.stringify(lessonIds),
          },
          { method: "post" }
        );
      } else {
        // Move lesson to a different module
        const sourceMod = course.modules.find((m) => m.id === sourceModuleId);
        if (!sourceMod) return;

        const lesson = sourceMod.lessons[result.source.index];
        if (!lesson) return;

        // Target position is 1-based (destination index + 1)
        const targetPosition = result.destination.index + 1;

        lessonReorderFetcher.submit(
          {
            intent: "move-lesson",
            lessonId: String(lesson.id),
            targetModuleId: String(destModuleId),
            targetPosition: String(targetPosition),
          },
          { method: "post" }
        );
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{course.title}</span>
      </nav>

      <Link
        to="/instructor"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to My Courses
      </Link>

      {/* Course Header with inline editing */}
      <div className="mb-8">
        <InlineEditableTitle value={course.title} courseId={course.id} />
        <div className="mt-2">
          <InlineEditableDescription
            value={course.description}
            courseId={course.id}
          />
        </div>

        {/* Stats row */}
        <div className="mt-4 flex flex-wrap items-center gap-4 px-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-4" />
            {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-4" />
            {enrollmentCount} {enrollmentCount === 1 ? "student" : "students"}
          </span>
          <span className="text-xs text-muted-foreground">
            Slug: /courses/{course.slug}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">
            <BookOpen className="size-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="size-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="sales-copy">
            <FileText className="size-4" />
            Sales Copy
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users className="size-4" />
            Students
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-6">
          <CourseContentEditor course={course} onDragEnd={handleDragEnd} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <CourseSettings
            course={course}
            onStatusChange={handleStatusChange}
            onPriceChange={handlePriceChange}
            onPppToggle={handlePppToggle}
          />
        </TabsContent>

        {/* Sales Copy Tab */}
        <TabsContent value="sales-copy" className="mt-6">
          <SalesCopyEditor
            value={salesCopy}
            savedValue={course.salesCopy}
            onChange={setSalesCopy}
            onSave={handleSalesCopySave}
            isSaving={salesCopyFetcher.state !== "idle"}
          />
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-6">
          <StudentRoster students={students} quizCount={quizCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading the course editor.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Course not found";
      message =
        "The course you're looking for doesn't exist or may have been removed.";
    } else if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Not allowed";
      message =
        typeof error.data === "string"
          ? error.data
          : "You don't have permission to edit this course.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
