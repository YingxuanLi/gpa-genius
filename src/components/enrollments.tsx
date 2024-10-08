"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { SearchCourse } from "./search-course";
import { useEnrollmentStore } from "~/app/stores/enrollment-store";

import { Button } from "./ui/button";
import { CrossIcon } from "./icons/cross-icon";
import { InfoIcon } from "./icons/info-icon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";
import { HurdleWarning } from "./hurdle-tooltip";
import { calculateRequiredMark } from "~/app/helpers/calculateRequiredMark";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectLabel,
  SelectGroup,
} from "./ui/select";
import TargetGradeSelect from "./target-grade-select";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Assessment =
  RouterOutput["user"]["getUserEnrollments"][0]["assessments"][0];

export function Enrollments() {
  const [showRankDialog, setShowRankDialog] = useState<boolean>(false);
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(
    null,
  );
  const [targetGrades, setTargetGrades] = useState<
    | {
        enrollmentId: string;
        targetGrade: string;
      }[]
    | null
  >(null);
  const { enrollments, setEnrollments, setScore } = useEnrollmentStore();
  const {
    data: enrollmentsData,
    isLoading,
    refetch: refetchEnrollments,
  } = api.user.getUserEnrollments.useQuery({ userId: "" });

  const { data: percentRank, refetch: refetchRank } =
    api.user.getUserAssessmentRankingByCourse.useQuery(
      {
        assessmentId: currentAssessment?.id || "",
      },
      { enabled: false },
    );
  const updateAssessment = api.user.updateUserAssessment.useMutation({
    onSuccess: async (course) => {
      console.info(`assessment updated::${JSON.stringify(course)}`);
    },
  });

  const deleteEnrollment = api.user.deleteUserEnrollment.useMutation({
    onSuccess: async (enrollment) => {
      console.info(`successfully deleted::${JSON.stringify(enrollment)}`);
      refetchEnrollments();
    },
  });

  useEffect(() => {
    if (enrollmentsData) {
      setEnrollments(enrollmentsData);
      const targetGrades = enrollmentsData.map((enrollment) => {
        return { enrollmentId: enrollment.id, targetGrade: "50" };
      });
      console.log(targetGrades);
      setTargetGrades(targetGrades);
    }
  }, [enrollmentsData]);

  useEffect(() => {
    if (currentAssessment) {
      refetchRank();
    }
  }, [currentAssessment]);

  // Handle score input change
  //TODO: when user inputs a score, call updateAssessment mutation
  const handleScoreChange = (
    enrollmentId: string,
    assessmentId: string,
    mark: number,
  ) => {
    // const updatedScores = [...scores];
    // updatedScores[courseIndex][assessmentIndex] = score;
    setScore(enrollmentId, assessmentId, mark);
    updateAssessment.mutate({ id: assessmentId, mark });
    // console.log(mark);
    // setScores(Number(score));
  };

  const handleEnrollmentDelete = (enrollmentId: string) => {
    deleteEnrollment.mutate({ enrollmentId });
  };

  const handleShowRankDialog = async (assessment: Assessment) => {
    setCurrentAssessment(assessment);
    setShowRankDialog(true);
    if (assessment) {
      refetchRank();
    }
  };
  const handleCloseRankDialog = () => {
    setShowRankDialog(false);
    setCurrentAssessment(null);
  };

  const handleTargetGradeChange = (enrollmentId: string, value: string) => {
    if (!targetGrades) return;
    // Create a new array with the updated target grades
    const updatedGrades = targetGrades.map((grade) =>
      grade.enrollmentId === enrollmentId
        ? { ...grade, targetGrade: value }
        : grade,
    );

    setTargetGrades(updatedGrades);
  };

  const calculateTotalScore = (assessments: any[]) => {
    return assessments.reduce((total, assessment, index) => {
      return total + assessment.mark * parseFloat(assessment.weight);
    }, 0);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex">
        <h1 className="mb-6 text-3xl font-bold">My Course Enrollments</h1>
        <SearchCourse />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {enrollments?.map((enrollment) => (
          <Card key={enrollment?.id} className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-l sm:text-l md:text-l lg:text-l xl:text-l truncate whitespace-normal">
                  {enrollment?.course.courseCode} -{" "}
                  {enrollment?.course.courseName}
                </CardTitle>
                <TargetGradeSelect
                  selectedValue={
                    targetGrades?.find((g) => g.enrollmentId === enrollment.id)
                      ?.targetGrade || "50"
                  }
                  onValueChange={(value) => {
                    console.log(targetGrades);
                    handleTargetGradeChange(enrollment.id, value);
                  }}
                />
                {/* <Select
                  defaultValue={"4"}
                  onValueChange={
                    (value) => console.log("value")
                    // handleTargetGradeChange(
                    //   course.id,
                    //   course.assessments[0].id,
                    //   parseInt(value),
                    // )
                  }
                  // className="w-20"
                >
                  <SelectTrigger className="w-15">
                    <SelectValue placeholder="Target Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Target Grade</SelectLabel>
                      <SelectItem value="0">1 (0-19%)</SelectItem>
                      <SelectItem value="20">2 (20-44%)</SelectItem>
                      <SelectItem value="45">3 (45-49%)</SelectItem>
                      <SelectItem value="50">4 (50-64%)</SelectItem>
                      <SelectItem value="65">5 (65-74%)</SelectItem>
                      <SelectItem value="75">6 (75-84%)</SelectItem>
                      <SelectItem value="85">7 (85-100%)</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select> */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEnrollmentDelete(enrollment?.id || "")}
                >
                  <CrossIcon className="h-4 w-4 hover:text-red-500" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enrollment?.assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium">
                          {assessment.assignmentName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Weight: {assessment.weight * 100}%
                        </div>
                      </div>
                      {/* @ts-ignore */}
                      {enrollment.course.assessments.find(
                        (a: any) => a.title === assessment.assignmentName,
                      ).isHurdled && <HurdleWarning />}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* TODO: better handle user input and api calls */}
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={assessment.mark || 0}
                        onChange={(e) => {
                          handleScoreChange(
                            enrollment.id,
                            assessment.id,
                            Number(e.target.value),
                          );
                          setCurrentAssessment(assessment);
                        }}
                        className="w-20"
                      />

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleShowRankDialog(assessment)}
                      >
                        <InfoIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <div className="flex flex-col justify-between">
                {enrollment.assessments.filter(
                  ({ mark }) => mark === null || mark === 0,
                ).length == 1 && (
                  <div className="font-medium">
                    Grade required to hit target:{" "}
                    {calculateRequiredMark(
                      enrollment.assessments,
                      Number(
                        targetGrades &&
                          targetGrades!.find(
                            (target) => target!.enrollmentId === enrollment.id,
                          )?.targetGrade,
                      ),
                    ) + "%"}
                  </div>
                )}
                <div className="font-medium">Overall Grade:</div>
                <div className="text-2xl font-bold">
                  {calculateTotalScore(enrollment!.assessments).toFixed(2)}
                </div>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
      {showRankDialog && currentAssessment && (
        <Dialog open={showRankDialog} onOpenChange={handleCloseRankDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Assessment Rank</DialogTitle>
              <DialogDescription>
                The rank of {currentAssessment?.assignmentName} for{" "}
                {
                  enrollments?.find(
                    (e) => e?.id === currentAssessment.enrollmentId,
                  )?.course.courseCode
                }{" "}
                within the cohort who uses this app.
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 py-6">
              <div className="mt-4 flex items-center justify-between">
                <div className="font-medium">You beat:</div>
                <div className="text-2xl font-bold">
                  {!!percentRank && Number(percentRank.rank * 100).toFixed(2)}%
                  of users
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCloseRankDialog}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
