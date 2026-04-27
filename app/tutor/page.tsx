"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
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

type LogItem = {
  id: string;
  action: string;
  className: string;
  date: string;
  period: number;
  status: string;
  actor: string;
  createdAt?: {
    seconds: number;
  };
};

const periods = [1, 2, 3, 4];
const weekdays = ["월", "화", "수", "목", "금"];

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekdayFromDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
}

function formatLogTime(log: LogItem) {
  if (!log.createdAt?.seconds) return "방금";
  const date = new Date(log.createdAt.seconds * 1000);
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export default function TutorPage() {
  const today = new Date();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [newAlert, setNewAlert] = useState(false);

  const previousCount = useRef(0);
  const initialized = useRef(false);

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

      const validData = data.filter((item) => item.date && item.period);

      if (initialized.current && validData.length > previousCount.current) {
        setNewAlert(true);
        playBeep();
        setTimeout(() => setNewAlert(false), 4000);
      }

      previousCount.current = validData.length;
      initialized.current = true;
      setRequests(validData);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "logs"), (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as LogItem[];

      const sortedLogs = data
        .filter((item) => item.date && item.period)
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

      setLogs(sortedLogs);
    });

    return () => unsubscribe();
  }, []);

  function moveMonth(diff: number) {
    const next = new Date(currentYear, currentMonth + diff, 1);
    setCurrentYear(next.getFullYear());
    setCurrentMonth(next.getMonth());
  }

  function playBeep() {
    try {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
      );
      audio.play();
    } catch {
      console.log("알림음 재생 실패");
    }
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

  async function updateStatus(item: RequestItem, status: string) {
    await updateDoc(doc(db, "requests", item.id), {
      status,
      updatedAt: serverTimestamp(),
    });

    await addLog({
      action: status === "확인" ? "확인" : "완료",
      className: item.className,
      date: item.date,
      period: item.period,
      status,
      actor: "디지털 튜터",
    });
  }

  const monthRequests = requests.filter((item) => {
    const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}`;

    const weekday = getWeekdayFromDateKey(item.date);

    return item.date.startsWith(monthKey) && weekday !== "금";
  });

  const sortedMonthRequests = [...monthRequests].sort((a, b) => {
    if (a.date === b.date) return a.period - b.period;
    return a.date.localeCompare(b.date);
  });

  const monthLogs = logs.filter((item) => {
    const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}`;
    return item.date.startsWith(monthKey);
  });

  function printMonthlyReport() {
    const rows = sortedMonthRequests
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${item.date}</td>
            <td>${getWeekdayFromDateKey(item.date)}</td>
            <td>${item.period}교시</td>
            <td>${item.className}</td>
            <td>${item.status}</td>
          </tr>
        `
      )
      .join("");

    const logRows = monthLogs
      .slice()
      .reverse()
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatLogTime(item)}</td>
            <td>${item.action}</td>
            <td>${item.date}</td>
            <td>${getWeekdayFromDateKey(item.date)}</td>
            <td>${item.period}교시</td>
            <td>${item.className}</td>
            <td>${item.actor}</td>
          </tr>
        `
      )
      .join("");

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
        <head>
          <meta charset="UTF-8" />
          <title>디지털 튜터 월별 수업지원 신청 목록</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              font-family: Arial, "Malgun Gothic", sans-serif;
              padding: 28px;
              color: #111827;
              background: #ffffff;
            }

            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-bottom: 2px solid #111827;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }

            h1 {
              font-size: 22px;
              margin: 0;
            }

            h2 {
              font-size: 16px;
              margin: 28px 0 10px;
            }

            .subtitle {
              margin-top: 6px;
              color: #4b5563;
              font-size: 14px;
            }

            .summary {
              font-size: 14px;
              font-weight: 700;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }

            th, td {
              border: 1px solid #d1d5db;
              padding: 7px;
              text-align: center;
            }

            th {
              background: #f3f4f6;
              font-weight: 700;
            }

            .empty {
              padding: 28px;
              text-align: center;
              color: #6b7280;
            }

            .footer {
              margin-top: 24px;
              font-size: 12px;
              color: #6b7280;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>디지털 튜터 월별 수업지원 신청 목록</h1>
              <div class="subtitle">${currentYear}년 ${
      currentMonth + 1
    }월, 월~목 운영</div>
            </div>
            <div class="summary">현재 신청 ${sortedMonthRequests.length}건</div>
          </div>

          <h2>현재 신청 현황</h2>
          <table>
            <thead>
              <tr>
                <th>순번</th>
                <th>날짜</th>
                <th>요일</th>
                <th>교시</th>
                <th>학반/장소</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows ||
                `<tr><td class="empty" colspan="6">이번 달 신청 내역이 없습니다.</td></tr>`
              }
            </tbody>
          </table>

          <h2>누적 처리 기록</h2>
          <table>
            <thead>
              <tr>
                <th>순번</th>
                <th>시간</th>
                <th>구분</th>
                <th>날짜</th>
                <th>요일</th>
                <th>교시</th>
                <th>학반/장소</th>
                <th>처리자</th>
              </tr>
            </thead>
            <tbody>
              ${
                logRows ||
                `<tr><td class="empty" colspan="8">이번 달 처리 기록이 없습니다.</td></tr>`
              }
            </tbody>
          </table>

          <div class="footer">
            출력일: ${new Date().toLocaleDateString("ko-KR")}
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  return (
    <main className="min-h-screen bg-green-50 p-2">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 mb-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900">
              🌿 디지털 튜터 수업지원 대시보드
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              월~목요일 1~4교시 신청 현황입니다. 튜터는 취소할 수 없습니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={printMonthlyReport}
              className="rounded-lg bg-green-700 text-white px-3 py-2 text-sm font-black hover:bg-green-800"
            >
              PDF 저장/인쇄
            </button>

            <div className="rounded-lg bg-green-700 text-white px-3 py-2 text-sm font-black">
              현재 신청 {monthRequests.length}건
            </div>
          </div>
        </header>

        {newAlert && (
          <div className="mb-2 rounded-xl bg-green-700 text-white p-3 text-lg font-black shadow animate-pulse">
            🔔 새 수업지원 신청!
          </div>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => moveMonth(-1)}
              className="rounded-lg bg-slate-100 text-slate-900 border border-slate-200 px-3 py-2 text-sm font-bold hover:bg-slate-200"
            >
              ◀ 이전
            </button>

            <div className="text-xl md:text-2xl font-black text-slate-900">
              {currentYear}년 {currentMonth + 1}월
            </div>

            <button
              onClick={() => moveMonth(1)}
              className="rounded-lg bg-slate-100 text-slate-900 border border-slate-200 px-3 py-2 text-sm font-bold hover:bg-slate-200"
            >
              다음 ▶
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1 mb-1">
            {weekdays.map((day) => (
              <div
                key={day}
                className={`text-center text-sm font-black border rounded-lg py-1.5 ${
                  day === "금"
                    ? "bg-slate-50 text-slate-400 border-slate-100"
                    : "bg-slate-100 text-slate-800 border-slate-200"
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
                        className="min-h-[105px] rounded-lg bg-slate-50 border border-slate-100"
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
                          ? "bg-slate-50 border-slate-100"
                          : isToday
                          ? "bg-green-50 border-green-500"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div
                          className={`font-black text-sm ${
                            isFriday ? "text-slate-400" : "text-slate-900"
                          }`}
                        >
                          {date.getDate()}일
                        </div>
                        {isToday && !isFriday && (
                          <div className="text-[10px] bg-green-700 text-white rounded-full px-1.5 py-0.5 font-bold">
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
                            const item = findRequest(dateKey, period);

                            return (
                              <button
                                key={period}
                                onClick={() => {
                                  if (!item) return;

                                  const next =
                                    item.status === "신청됨"
                                      ? "확인"
                                      : item.status === "확인"
                                      ? "완료"
                                      : "신청됨";

                                  updateStatus(item, next);
                                }}
                                className={`rounded-md px-1 py-1 text-xs font-bold text-center leading-tight border ${
                                  item
                                    ? item.status === "완료"
                                      ? "bg-slate-800 text-white border-slate-800"
                                      : item.status === "확인"
                                      ? "bg-slate-200 text-slate-900 border-slate-300"
                                      : "bg-green-100 text-green-900 border-green-200"
                                    : "bg-slate-50 text-slate-400 border-slate-100"
                                }`}
                                title={
                                  item
                                    ? "클릭하면 신청됨 → 확인 → 완료 순서로 변경됩니다."
                                    : ""
                                }
                              >
                                {item
                                  ? `${period}교 ${item.className}`
                                  : `${period}교 -`}
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

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
            <div className="rounded bg-green-100 text-green-900 border border-green-200 px-2 py-1 font-bold">
              신청됨
            </div>
            <div className="rounded bg-slate-200 text-slate-900 border border-slate-300 px-2 py-1 font-bold">
              확인
            </div>
            <div className="rounded bg-slate-800 text-white px-2 py-1 font-bold">
              완료
            </div>
            <div className="rounded bg-slate-100 text-slate-400 border border-slate-100 px-2 py-1 font-bold">
              금요일 미운영
            </div>
          </div>
        </section>

        <section className="mt-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
            <h2 className="font-black text-base text-slate-900">
              현재 월별 신청 목록
            </h2>

            <button
              onClick={printMonthlyReport}
              className="rounded-lg bg-green-700 text-white px-3 py-2 text-sm font-bold hover:bg-green-800"
            >
              이 목록 PDF 저장/인쇄
            </button>
          </div>

          {sortedMonthRequests.length === 0 ? (
            <p className="text-sm text-slate-400">
              이번 달 신청 내역이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-200 px-2 py-2">
                      순번
                    </th>
                    <th className="border border-slate-200 px-2 py-2">
                      날짜
                    </th>
                    <th className="border border-slate-200 px-2 py-2">
                      요일
                    </th>
                    <th className="border border-slate-200 px-2 py-2">
                      교시
                    </th>
                    <th className="border border-slate-200 px-2 py-2">
                      학반/장소
                    </th>
                    <th className="border border-slate-200 px-2 py-2">
                      상태
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedMonthRequests.map((item, index) => (
                    <tr key={item.id} className="text-center">
                      <td className="border border-slate-200 px-2 py-2">
                        {index + 1}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 font-bold">
                        {item.date}
                      </td>
                      <td className="border border-slate-200 px-2 py-2">
                        {getWeekdayFromDateKey(item.date)}
                      </td>
                      <td className="border border-slate-200 px-2 py-2">
                        {item.period}교시
                      </td>
                      <td className="border border-slate-200 px-2 py-2 font-bold">
                        {item.className}
                      </td>
                      <td className="border border-slate-200 px-2 py-2">
                        {item.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
          <h2 className="font-black text-base text-slate-900 mb-2">
            누적 신청/취소/처리 기록
          </h2>

          {monthLogs.length === 0 ? (
            <p className="text-sm text-slate-400">
              이번 달 누적 기록이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-200 px-2 py-2">
                      시간
                    </th>
                    <th className="border border-slate-200 px-2 py-2">
                      구분
                    </th>
                    <th className="border border-slate-200 px-2 py-2">
                      날짜
                    </th>
                    <th className="border border-slate-200 px-2 py-2">
                      교시
                    </th>
                    <th className="border border-slate-200 px-2 py-2">
                      학반/장소
                    </th>
                    <th className="border border-slate-200 px-2 py-2">
                      처리자
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {monthLogs.map((item) => (
                    <tr key={item.id} className="text-center">
                      <td className="border border-slate-200 px-2 py-2">
                        {formatLogTime(item)}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 font-bold">
                        {item.action}
                      </td>
                      <td className="border border-slate-200 px-2 py-2">
                        {item.date}
                      </td>
                      <td className="border border-slate-200 px-2 py-2">
                        {item.period}교시
                      </td>
                      <td className="border border-slate-200 px-2 py-2 font-bold">
                        {item.className}
                      </td>
                      <td className="border border-slate-200 px-2 py-2">
                        {item.actor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}