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

const classes = ["1-1", "2-1", "3-1", "4-1", "5-1", "6-1"];
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

  async function handlePeriodClick(dateKey: string, period: number) {
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
              빈 교시는 신청, 내 학반이 신청한 교시는 다시 누르면 취소됩니다.
            </p>
          </div>

          <label className="flex items-center gap-2">
            <span className="font-bold text-slate-700">학반</span>
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
                className="text-center text-sm font-black bg-blue-100 text-blue-800 rounded-lg py-1.5"
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

                  return (
                    <div
                      key={dateKey}
                      className={`min-h-[105px] rounded-lg border p-1.5 ${
                        isToday
                          ? "bg-yellow-50 border-yellow-400"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-black text-sm text-slate-800">
                          {date.getDate()}일
                        </div>
                        {isToday && (
                          <div className="text-[10px] bg-yellow-300 rounded-full px-1.5 py-0.5 font-bold">
                            오늘
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        {periods.map((period) => {
                          const existing = findRequest(dateKey, period);
                          const key = `${dateKey}-${period}`;
                          const isMine = existing?.className === selectedClass;

                          return (
                            <button
                              key={period}
                              onClick={() => handlePeriodClick(dateKey, period)}
                              disabled={loadingKey === key}
                              className={`rounded-md px-1 py-1 text-xs font-bold text-center leading-tight ${
                                existing
                                  ? isMine
                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                    : "bg-slate-200 text-slate-500"
                                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                              }`}
                              title={
                                existing
                                  ? isMine
                                    ? "다시 누르면 취소됩니다."
                                    : "다른 학반이 이미 신청했습니다."
                                  : "신청 가능"
                              }
                            >
                              {existing
                                ? isMine
                                  ? `${period}교 ${existing.className} 취소`
                                  : `${period}교 ${existing.className}`
                                : `${period}교시`}
                            </button>
                          );
                        })}
                      </div>
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
              내 학반 신청, 다시 클릭 시 취소
            </div>
            <div className="rounded bg-slate-200 text-slate-500 px-2 py-1 font-bold">
              다른 학반 신청
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}