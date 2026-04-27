"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type RequestItem = {
  id: string;
  className: string;
  date: string;
  period: number;
  type: string;
  status: string;
};

const classes = [
  "1-1",
  "2-1",
  "3-1",
  "4-1",
  "5-1",
  "6-1",
  "영어실",
  "통합1반",
  "통합2반",
];

const periods = [1, 2, 3, 4];
const weekdays = ["월", "화", "수", "목", "금"];

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeCalendarWeeks(year: number, month: number) {
  const lastDate = new Date(year, month + 1, 0).getDate();

  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [null, null, null, null, null];

  for (let day = 1; day <= lastDate; day++) {
    const date = new Date(year, month, day);
    const dow = date.getDay();

    if (dow === 0 || dow === 6) continue;

    const index = dow - 1;

    if (dow === 1 && week.some(Boolean)) {
      weeks.push(week);
      week = [null, null, null, null, null];
    }

    week[index] = date;
  }

  if (week.some(Boolean)) weeks.push(week);

  return weeks;
}

function getButtonClass(existing: RequestItem | undefined, isMine: boolean) {
  if (!existing) {
    return "bg-blue-50 text-blue-700 hover:bg-blue-100";
  }

  if (!isMine) {
    return "bg-slate-200 text-slate-500";
  }

  if (existing.status === "확인") {
    return "bg-orange-100 text-orange-900 hover:bg-orange-200";
  }

  if (existing.status === "완료") {
    return "bg-slate-800 text-white hover:bg-slate-700";
  }

  return "bg-green-100 text-green-800 hover:bg-green-200";
}

function getButtonText(
  period: number,
  existing: RequestItem | undefined,
  isMine: boolean
) {
  if (!existing) return `${period}교시`;

  if (!isMine) return `${period}교 ${existing.className}`;

  if (existing.status === "확인") {
    return `${period}교 확인됨`;
  }

  if (existing.status === "완료") {
    return `${period}교 완료`;
  }

  return `${period}교 ${existing.className} 취소`;
}

export default function TeacherPage() {
  const today = new Date();

  const [selectedClass, setSelectedClass] = useState("1-1");
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loadingKey, setLoadingKey] = useState("");

  const weeks = useMemo(
    () => makeCalendarWeeks(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "requests"), (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as RequestItem[];

      setRequests(data.filter((item) => item.date && item.period));
    });

    return () => unsubscribe();
  }, []);

  function moveMonth(diff: number) {
    const next = new Date(currentYear, currentMonth + diff, 1);
    setCurrentYear(next.getFullYear());
    setCurrentMonth(next.getMonth());
  }

  function findRequest(dateKey: string, period: number) {
    return requests.find(
      (item) => item.date === dateKey && item.period === period
    );
  }

  async function addLog({
    action,
    className,
    date,
    period,
    status,
    actor,
  }: {
    action: string;
    className: string;
    date: string;
    period: number;
    status: string;
    actor: string;
  }) {
    await addDoc(collection(db, "logs"), {
      action,
      className,
      date,
      period,
      status,
      actor,
      createdAt: serverTimestamp(),
    });
  }

  async function handlePeriodClick(date: Date, period: number) {
    const day = date.getDay();

    if (day === 5) {
      alert("금요일은 디지털 튜터 수업지원 신청일이 아닙니다.");
      return;
    }

    const dateKey = toDateKey(date);
    const existing = findRequest(dateKey, period);
    const key = `${dateKey}-${period}`;
    setLoadingKey(key);

    try {
      if (existing) {
        if (existing.className !== selectedClass) {
          alert(
            `${dateKey} ${period}교시는 이미 ${existing.className}이 신청했습니다.`
          );
          return;
        }

        const ok = confirm(
          `${dateKey} ${period}교시 ${selectedClass} 신청을 취소할까요?`
        );

        if (!ok) return;

        await addLog({
          action: "취소",
          className: existing.className,
          date: existing.date,
          period: existing.period,
          status: existing.status,
          actor: existing.className,
        });

        await deleteDoc(doc(db, "requests", existing.id));
        return;
      }

      const ok = confirm(
        `${dateKey} ${period}교시에 ${selectedClass} 수업지원을 신청할까요?`
      );

      if (!ok) return;

      await addDoc(collection(db, "requests"), {
        className: selectedClass,
        date: dateKey,
        period,
        type: "수업지원",
        status: "신청됨",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addLog({
        action: "신청",
        className: selectedClass,
        date: dateKey,
        period,
        status: "신청됨",
        actor: selectedClass,
      });
    } catch (error) {
      console.error(error);
      alert("처리 중 오류가 발생했습니다.");
    } finally {
      setLoadingKey("");
    }
  }

  return (
    <main className="min-h-screen bg-blue-50 p-2">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white rounded-2xl shadow p-3 mb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-blue-900">
              🗓️ 디지털 튜터 수업지원 신청
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              월~목요일만 신청 가능합니다. 내 신청은 다시 누르면 취소됩니다.
            </p>
          </div>

          <label className="flex items-center gap-2">
            <span className="font-bold text-slate-700">신청 장소/학반</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="border rounded-xl px-3 py-2 text-base font-bold"
            >
              {classes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </header>

        <section className="bg-white rounded-2xl shadow p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => moveMonth(-1)}
              className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-bold"
            >
              ◀ 이전
            </button>

            <div className="text-xl md:text-2xl font-black text-slate-900">
              {currentYear}년 {currentMonth + 1}월
            </div>

            <button
              onClick={() => moveMonth(1)}
              className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-bold"
            >
              다음 ▶
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1 mb-1">
            {weekdays.map((day) => (
              <div
                key={day}
                className={`text-center text-sm font-black rounded-lg py-1.5 ${
                  day === "금"
                    ? "bg-slate-100 text-slate-400"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid gap-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-5 gap-1">
                {week.map((date, dayIndex) => {
                  if (!date) {
                    return (
                      <div
                        key={dayIndex}
                        className="min-h-[105px] rounded-lg bg-slate-50 border"
                      />
                    );
                  }

                  const dateKey = toDateKey(date);
                  const isToday = dateKey === toDateKey(today);
                  const isFriday = date.getDay() === 5;

                  return (
                    <div
                      key={dateKey}
                      className={`min-h-[105px] rounded-lg border p-1.5 ${
                        isFriday
                          ? "bg-slate-50 border-slate-200"
                          : isToday
                          ? "bg-yellow-50 border-yellow-400"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div
                          className={`font-black text-sm ${
                            isFriday ? "text-slate-400" : "text-slate-800"
                          }`}
                        >
                          {date.getDate()}일
                        </div>
                        {isToday && !isFriday && (
                          <div className="text-[10px] bg-yellow-300 rounded-full px-1.5 py-0.5 font-bold">
                            오늘
                          </div>
                        )}
                      </div>

                      {isFriday ? (
                        <div className="h-[70px] flex items-center justify-center rounded-md bg-slate-100 text-slate-400 text-xs font-bold">
                          튜터 없음
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1">
                          {periods.map((period) => {
                            const existing = findRequest(dateKey, period);
                            const key = `${dateKey}-${period}`;
                            const isMine =
                              existing?.className === selectedClass;

                            return (
                              <button
                                key={period}
                                onClick={() => handlePeriodClick(date, period)}
                                disabled={loadingKey === key}
                                className={`rounded-md px-1 py-1 text-xs font-bold text-center leading-tight ${getButtonClass(
                                  existing,
                                  isMine
                                )}`}
                                title={
                                  existing
                                    ? isMine
                                      ? existing.status === "확인"
                                        ? "튜터가 확인했습니다. 다시 누르면 취소됩니다."
                                        : existing.status === "완료"
                                        ? "튜터가 완료 처리했습니다. 다시 누르면 취소됩니다."
                                        : "다시 누르면 취소됩니다."
                                      : "다른 학반이 이미 신청했습니다."
                                    : "신청 가능"
                                }
                              >
                                {getButtonText(period, existing, isMine)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <div className="rounded bg-blue-50 text-blue-700 px-2 py-1 font-bold">
              신청 가능
            </div>
            <div className="rounded bg-green-100 text-green-800 px-2 py-1 font-bold">
              내 신청
            </div>
            <div className="rounded bg-orange-100 text-orange-900 px-2 py-1 font-bold">
              튜터 확인
            </div>
            <div className="rounded bg-slate-800 text-white px-2 py-1 font-bold">
              완료
            </div>
            <div className="rounded bg-slate-200 text-slate-500 px-2 py-1 font-bold">
              다른 신청 또는 금요일 미운영
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}